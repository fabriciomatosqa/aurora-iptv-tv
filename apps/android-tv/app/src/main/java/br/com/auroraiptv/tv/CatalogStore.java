package br.com.auroraiptv.tv;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.os.CancellationSignal;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.*;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Android-only catalog. WAL readers see the previous committed catalog while a writer imports. */
final class CatalogStore extends SQLiteOpenHelper {
    private final Context context;
    private Writer migration;
    private final Set<CancellationSignal> pageQueries=java.util.concurrent.ConcurrentHashMap.newKeySet();
    void cancelPageQueries(){for(CancellationSignal query:pageQueries)query.cancel();}
    CatalogStore(Context context){this(context,"android_catalog.db");}
    CatalogStore(Context context,String database){super(context,database,null,1);this.context=context.getApplicationContext();setWriteAheadLoggingEnabled(true);}
    @Override public void onConfigure(SQLiteDatabase db){db.setForeignKeyConstraintsEnabled(true);}
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE libraries(id TEXT PRIMARY KEY,ready INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,live INTEGER NOT NULL DEFAULT 0,movies INTEGER NOT NULL DEFAULT 0,series INTEGER NOT NULL DEFAULT 0,unknown INTEGER NOT NULL DEFAULT 0,guide TEXT NOT NULL DEFAULT '',etag TEXT NOT NULL DEFAULT '',modified TEXT NOT NULL DEFAULT '',hash TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT '')");
        db.execSQL("CREATE TABLE entries(id INTEGER PRIMARY KEY,playlist TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,url TEXT NOT NULL,kind TEXT NOT NULL,group_name TEXT NOT NULL,show_key TEXT NOT NULL,season INTEGER NOT NULL,episode INTEGER NOT NULL,adult INTEGER NOT NULL,title_norm TEXT NOT NULL,guide_name TEXT NOT NULL,tvg TEXT NOT NULL,json TEXT NOT NULL,UNIQUE(playlist,url))");
        db.execSQL("CREATE INDEX entries_type ON entries(playlist,kind,adult,id)");
        db.execSQL("CREATE INDEX entries_group ON entries(playlist,kind,group_name,adult,id)");
        db.execSQL("CREATE INDEX entries_show ON entries(playlist,show_key,adult,season,episode,id)");
        db.execSQL("CREATE INDEX entries_tvg ON entries(playlist,tvg,id)");
        db.execSQL("CREATE INDEX entries_name ON entries(playlist,guide_name,id)");
        db.execSQL("CREATE TABLE shows(playlist TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,show_key TEXT NOT NULL,title_norm TEXT NOT NULL,adult INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(playlist,show_key))");
        db.execSQL("CREATE INDEX shows_browse ON shows(playlist,adult,show_key)");
        db.execSQL("CREATE TABLE groups(playlist TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,kind TEXT NOT NULL,name TEXT NOT NULL,public_count INTEGER NOT NULL,total INTEGER NOT NULL,PRIMARY KEY(playlist,kind,name))");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){throw new IllegalStateException("Migração de catálogo não disponível.");}
    private static long number(SQLiteDatabase db,String sql,String...args){try(Cursor c=db.rawQuery(sql,args)){return c.moveToFirst()?c.getLong(0):0;}}
    private static String text(SQLiteDatabase db,String sql,String...args){try(Cursor c=db.rawQuery(sql,args)){return c.moveToFirst()?c.getString(0):"";}}
    private static String canon(String value){return CatalogParser.normalized(value).replaceAll("[^a-z0-9]+"," ").trim();}
    private static String like(String value){return "%"+CatalogParser.normalized(value).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";}
    JSONObject summary(String id) throws Exception {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT ready,total,live,movies,series,unknown,guide FROM libraries WHERE id=?",new String[]{id})){
            if(!c.moveToFirst())return new JSONObject().put("ready",false);
            return new JSONObject().put("ready",c.getInt(0)!=0).put("total",c.getLong(1)).put("live",c.getLong(2)).put("movies",c.getLong(3)).put("series",c.getLong(4)).put("unknown",c.getLong(5)).put("guideUrl",c.getString(6));
        }
    }
    JSONObject page(JSONObject request) throws Exception {
        String id=request.getString("playlist"),kind=request.optString("kind","live"),show=request.optString("show");
        boolean series=kind.equals("series")&&show.isEmpty(),unlocked=request.optBoolean("unlocked");
        String table=series?"shows":"entries",where="playlist=?";
        List<String> args=new ArrayList<>();args.add(id);
        if(!series){where+=" AND kind=?";args.add(kind);}
        if(!unlocked)where+=" AND adult=0";
        if(!show.isEmpty()){where+=" AND show_key=?";args.add(show);}
        if(!show.isEmpty() && request.has("season") && !request.optString("season").isEmpty()){where+=" AND season=?";args.add(request.getString("season"));}
        if(!request.optString("search").trim().isEmpty()){where+=" AND title_norm LIKE ? ESCAPE '\\'";args.add(like(request.optString("search").trim()));}
        if(!series && !request.optString("group").isEmpty()){where+=" AND group_name=?";args.add(request.getString("group"));}
        if(series && !request.optString("group").isEmpty()){where+=" AND show_key IN (SELECT show_key FROM entries WHERE playlist=? AND kind='series' AND group_name=?)";args.add(id);args.add(request.getString("group"));}
        int limit=Math.max(1,Math.min(60,request.optInt("limit",48))),offset=Math.max(0,request.optInt("offset"));
        SQLiteDatabase db=getReadableDatabase();JSONArray rows=new JSONArray();
        String order=series?"show_key":show.isEmpty()?"id":"season,episode,id";
        boolean more=false;
        // One sentinel row avoids COUNT(*) and a second scan on every page.
        CancellationSignal signal=new CancellationSignal();pageQueries.add(signal);
        try(Cursor c=db.rawQuery("SELECT json FROM "+table+" WHERE "+where+" ORDER BY "+order+" LIMIT "+(limit+1)+" OFFSET "+offset,args.toArray(new String[0]),signal)){while(c.moveToNext()){if(rows.length()==limit){more=true;break;}rows.put(new JSONObject(c.getString(0)));}}
        finally{pageQueries.remove(signal);}
        return new JSONObject().put("items",rows).put("more",more).put("offset",offset);
    }
    JSONArray groups(JSONObject request) throws Exception {
        JSONArray result=new JSONArray();int offset=Math.max(0,request.optInt("offset"));
        try(Cursor c=getReadableDatabase().rawQuery("SELECT name,total FROM groups WHERE playlist=? AND kind=? AND "+(request.optBoolean("unlocked")?"total":"public_count")+">0 ORDER BY name LIMIT 49 OFFSET "+offset,new String[]{request.getString("playlist"),request.getString("kind")})){
            while(c.moveToNext())result.put(c.getString(0));
        }return result;
    }
    JSONArray seasons(JSONObject request) throws Exception {
        JSONArray result=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT DISTINCT season FROM entries WHERE playlist=? AND show_key=? AND kind='series'"+(request.optBoolean("unlocked")?"":" AND adult=0")+" ORDER BY season",new String[]{request.getString("playlist"),request.getString("show")})){while(c.moveToNext())result.put(c.getInt(0));}
        return result;
    }
    JSONObject favorites(JSONObject request) throws Exception {
        String playlist=request.getString("playlist");JSONArray keys=request.getJSONArray("keys"),rows=new JSONArray();
        int offset=Math.max(0,request.optInt("offset")),matched=0;SQLiteDatabase db=getReadableDatabase();
        for(int i=0;i<keys.length();i++) {
            String key=keys.getString(i),json;
            if(key.startsWith("series:"))json=text(db,"SELECT json FROM shows WHERE playlist=? AND show_key=?"+(request.optBoolean("unlocked")?"":" AND adult=0"),playlist,key.substring(7).toLowerCase(Locale.ROOT));
            else json=text(db,"SELECT json FROM entries WHERE playlist=? AND url=? AND kind<>'series'"+(request.optBoolean("unlocked")?"":" AND adult=0"),playlist,key);
            if(json.isEmpty())continue;
            if(matched>=offset && rows.length()<48)rows.put(new JSONObject(json));matched++;
        }
        return new JSONObject().put("items",rows).put("more",matched>offset+rows.length()).put("offset",offset);
    }
    JSONArray guideChannels(JSONObject request) throws Exception {
        JSONArray input=request.getJSONArray("channels"),result=new JSONArray();if(input.length()>128)throw new IOException("Lote de guia inválido.");
        String id=request.getString("playlist"),adult=request.optBoolean("unlocked")?"":" AND adult=0";SQLiteDatabase db=getReadableDatabase();
        Set<String> programIds=new HashSet<>();JSONArray ids=request.getJSONArray("programIds");for(int i=0;i<ids.length();i++)programIds.add(ids.getString(i));
        for(int i=0;i<input.length();i++) {
            JSONObject channel=input.getJSONObject(i);String json=text(db,"SELECT json FROM entries WHERE playlist=? AND tvg=? AND kind='live'"+adult+" ORDER BY id LIMIT 1",id,channel.getString("id"));
            if(json.isEmpty() && channel.optBoolean("uniqueName")) {
                // Preserve exact canonical-name fallback; a valid different tvgId takes precedence.
                try(Cursor c=db.rawQuery("SELECT json FROM entries WHERE playlist=? AND guide_name=? AND kind='live'"+adult+" ORDER BY id",new String[]{id,canon(channel.optString("name"))})){
                    while(c.moveToNext()) {JSONObject item=new JSONObject(c.getString(0));if(!programIds.contains(item.optString("tvgId"))){json=c.getString(0);break;}}
                }
            }
            if(!json.isEmpty())result.put(new JSONObject(json));
        }return result;
    }
    final class Writer implements AutoCloseable {
        final SQLiteDatabase db;final String playlist;final Map<String,long[]> kinds=new HashMap<>();
        final SQLiteStatement find,insert,update,touchShow,touchGroup;long added,changed;boolean finished;
        Writer(String id) {
            playlist=id;db=getWritableDatabase();db.beginTransactionNonExclusive();
            try {
                db.execSQL("INSERT OR IGNORE INTO libraries(id) VALUES(?)",new Object[]{id});
                db.execSQL("CREATE TEMP TABLE IF NOT EXISTS touched_shows(show_key TEXT PRIMARY KEY)");db.execSQL("DELETE FROM touched_shows");
                db.execSQL("CREATE TEMP TABLE IF NOT EXISTS touched_groups(kind TEXT,name TEXT,PRIMARY KEY(kind,name))");db.execSQL("DELETE FROM touched_groups");
                find=db.compileStatement("SELECT json FROM entries WHERE playlist=? AND url=?");
                insert=db.compileStatement("INSERT INTO entries(playlist,url,kind,group_name,show_key,season,episode,adult,title_norm,guide_name,tvg,json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
                update=db.compileStatement("UPDATE entries SET kind=?,group_name=?,show_key=?,season=?,episode=?,adult=?,title_norm=?,guide_name=?,tvg=?,json=? WHERE playlist=? AND url=?");
                touchShow=db.compileStatement("INSERT OR IGNORE INTO touched_shows VALUES(?)");touchGroup=db.compileStatement("INSERT OR IGNORE INTO touched_groups VALUES(?,?)");
            }catch(RuntimeException e){db.endTransaction();throw e;}
        }
        private void touch(JSONObject row,int direction) throws Exception {
            String type=row.optString("type","unknown");kinds.computeIfAbsent(type,k->new long[1])[0]+=direction;
            touchGroup.bindString(1,type);touchGroup.bindString(2,row.optString("group"));touchGroup.executeInsert();
            if(type.equals("series")){touchShow.bindString(1,CatalogParser.seriesKey(row.optString("catalogSeriesTitle",row.getString("title"))));touchShow.executeInsert();}
        }
        void accept(JSONObject input) throws Exception {
            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
            String url=input.optString("url");if(CatalogParser.resolve("https://invalid.test",url).isEmpty() || !url.matches("(?i)^https?://.*"))return;
            String type=input.optString("type");if(!Arrays.asList("live","movies","series","unknown").contains(type))type="unknown";
            JSONObject row=new JSONObject().put("title",input.optString("title","Sem título")).put("group",input.optString("group")).put("url",url)
                .put("type",type).put("logo",input.optString("logo")).put("tvgId",input.optString("tvgId"));
            // Keep legacy semantics and opaque provider URLs exactly; never guess identity from title.
            String previous="";find.bindString(1,playlist);find.bindString(2,url);
            try{previous=find.simpleQueryForString();}catch(SQLiteDoneException ignored){}
            if(type.equals("series")){
                String identity=CatalogParser.seriesTitle(row.getString("title"));
                row.put("catalogSeriesTitle",identity);
                // Most rows retain their original title. Compare their canonical
                // representation before decoding the old JSON just to recover identity.
                if(!previous.isEmpty() && previous.equals(row.toString()))return;
                if(!previous.isEmpty()){
                    JSONObject old=new JSONObject(previous);
                    if(old.optString("type").equals("series"))identity=old.optString("catalogSeriesTitle",CatalogParser.seriesTitle(old.getString("title")));
                }
                row.put("catalogSeriesTitle",identity);
            }
            String json=row.toString();if(previous.equals(json))return;
            boolean existing=!previous.isEmpty();if(existing)touch(new JSONObject(previous),-1);touch(row,1);
            int[] episode=CatalogParser.episode(row.getString("title"));String show=type.equals("series")?CatalogParser.seriesKey(row.getString("catalogSeriesTitle")):"";
            SQLiteStatement statement=existing?update:insert;int b=1;
            if(!existing){statement.bindString(b++,playlist);statement.bindString(b++,url);}
            statement.bindString(b++,type);statement.bindString(b++,row.getString("group"));statement.bindString(b++,show);
            statement.bindLong(b++,episode[0]);statement.bindLong(b++,episode[1]);statement.bindLong(b++,CatalogParser.restricted(row)?1:0);
            statement.bindString(b++,CatalogParser.normalized(row.getString("title")));statement.bindString(b++,canon(row.getString("title")));
            statement.bindString(b++,row.getString("tvgId"));statement.bindString(b++,json);
            if(existing){statement.bindString(b++,playlist);statement.bindString(b,url);statement.executeUpdateDelete();changed++;}else{statement.executeInsert();added++;}
        }
        JSONObject commit(String guide,String etag,String modified,String hash,String source) throws Exception {
            try(Cursor c=db.rawQuery("SELECT show_key FROM touched_shows",null)) {while(c.moveToNext()) {
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
                String key=c.getString(0);long count=number(db,"SELECT COUNT(*) FROM entries WHERE playlist=? AND show_key=? AND kind='series'",playlist,key);
                if(count==0){db.delete("shows","playlist=? AND show_key=?",new String[]{playlist,key});continue;}
                String first=text(db,"SELECT json FROM entries WHERE playlist=? AND show_key=? AND kind='series' ORDER BY id LIMIT 1",playlist,key);
                JSONObject row=new JSONObject(first);String title=CatalogParser.seriesTitle(row.getString("title"));
                boolean adult=number(db,"SELECT EXISTS(SELECT 1 FROM entries WHERE playlist=? AND show_key=? AND adult=1)",playlist,key)!=0;
                JSONObject directory=new JSONObject().put("title",title).put("type","series").put("logo",row.optString("logo")).put("group",row.optString("group"))
                    .put("showKey",key).put("favoriteSeriesTitle",row.optString("catalogSeriesTitle",title)).put("episodeCount",count).put("restricted",adult);
                db.execSQL("INSERT OR REPLACE INTO shows VALUES(?,?,?,?,?)",new Object[]{playlist,key,CatalogParser.normalized(title),adult?1:0,directory.toString()});
            }}
            try(Cursor c=db.rawQuery("SELECT kind,name FROM touched_groups",null)){while(c.moveToNext()){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
                String kind=c.getString(0),name=c.getString(1);
                long total=number(db,"SELECT COUNT(*) FROM entries WHERE playlist=? AND kind=? AND group_name=?",playlist,kind,name);
                long visible=number(db,"SELECT COUNT(*) FROM entries WHERE playlist=? AND kind=? AND group_name=? AND adult=0",playlist,kind,name);
                db.execSQL("INSERT OR REPLACE INTO groups VALUES(?,?,?,?,?)",new Object[]{playlist,kind,name,visible,total});
            }}
            long live=kinds.getOrDefault("live",new long[1])[0],movies=kinds.getOrDefault("movies",new long[1])[0],episodes=kinds.getOrDefault("series",new long[1])[0],unknown=kinds.getOrDefault("unknown",new long[1])[0];
            db.execSQL("UPDATE libraries SET ready=1,total=total+?,live=live+?,movies=movies+?,unknown=unknown+?,series=(SELECT COUNT(*) FROM shows WHERE playlist=?),etag=?,modified=?,hash=?,source=? WHERE id=?",new Object[]{live+movies+episodes+unknown,live,movies,unknown,playlist,etag,modified,hash,source,playlist});
            if(!guide.isEmpty())db.execSQL("UPDATE libraries SET guide=? WHERE id=?",new Object[]{guide,playlist});
            db.setTransactionSuccessful();finished=true;db.endTransaction();closeStatements();
            return summary(playlist).put("added",added).put("changed",changed);
        }
        private void closeStatements(){find.close();insert.close();update.close();touchShow.close();touchGroup.close();}
        @Override public void close(){if(!finished){finished=true;db.endTransaction();closeStatements();}}
    }
    JSONObject importReader(String id,Reader reader,String base) throws Exception {
        try(Writer writer=new Writer(id)){CatalogParser.Result parsed=CatalogParser.scan(reader,base,writer::accept);return writer.commit(parsed.guide,"","","",base);}
    }
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b));return s.toString();}
    JSONObject refresh(String id,String source,String pasted) throws Exception {
        if(migration!=null)throw new IOException("A migração local ainda está em andamento.");
        if(!pasted.isEmpty())return importReader(id,new StringReader(pasted),source);
        URL url=new URL(source);if(!url.getProtocol().equals("http")&&!url.getProtocol().equals("https"))throw new IOException("URL inválida.");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();File file=File.createTempFile("catalog-",".m3u",context.getCacheDir());
        long wire=0;String etag="",modified="",hash;
        try {
            connection.setConnectTimeout(12000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept-Encoding","gzip");
            SQLiteDatabase db=getReadableDatabase();boolean ready=summary(id).optBoolean("ready");String oldSource=text(db,"SELECT source FROM libraries WHERE id=?",id);
            if(ready && source.equals(oldSource)) {
                etag=text(db,"SELECT etag FROM libraries WHERE id=?",id);modified=text(db,"SELECT modified FROM libraries WHERE id=?",id);
                if(!etag.isEmpty())connection.setRequestProperty("If-None-Match",etag);
                if(!modified.isEmpty())connection.setRequestProperty("If-Modified-Since",modified);
            }
            int code=connection.getResponseCode();if(code==304 && ready && source.equals(oldSource))return summary(id).put("added",0).put("changed",0).put("notModified",true).put("wireBytes",0);
            if(code/100!=2)throw new IOException("O servidor não retornou uma lista válida.");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");String resolved=connection.getURL().toString();digest.update((resolved+"\u0000").getBytes("UTF-8"));
            final long[] counted={0};InputStream raw=new FilterInputStream(connection.getInputStream()){
                @Override public int read() throws IOException{int v=in.read();if(v>=0)counted[0]++;return v;}
                @Override public int read(byte[] b,int o,int n)throws IOException{int v=in.read(b,o,n);if(v>0)counted[0]+=v;return v;}
            };
            try(InputStream input="gzip".equalsIgnoreCase(connection.getContentEncoding())?new GZIPInputStream(raw,65536):raw;OutputStream output=new BufferedOutputStream(new FileOutputStream(file),65536)) {
                byte[] buffer=new byte[65536];int n;while((n=input.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();digest.update(buffer,0,n);output.write(buffer,0,n);}
            }
            wire=counted[0];long expected=connection.getContentLengthLong();if(expected>=0 && wire!=expected)throw new EOFException("Resposta de catálogo incompleta.");
            hash=hex(digest.digest());etag=Objects.toString(connection.getHeaderField("ETag"),"");modified=Objects.toString(connection.getHeaderField("Last-Modified"),"");
            if(ready && hash.equals(text(db,"SELECT hash FROM libraries WHERE id=?",id))) {
                db.execSQL("UPDATE libraries SET etag=?,modified=?,source=? WHERE id=?",new Object[]{etag,modified,source,id});
                return summary(id).put("added",0).put("changed",0).put("sameBody",true).put("wireBytes",wire);
            }
            try(Reader reader=new BufferedReader(new InputStreamReader(new FileInputStream(file),"UTF-8"),65536);Writer writer=new Writer(id)) {
                CatalogParser.Result parsed=CatalogParser.scan(reader,resolved,writer::accept);
                return writer.commit(parsed.guide,etag,modified,hash,source).put("wireBytes",wire);
            }
        }finally{connection.disconnect();file.delete();}
    }
    JSONObject mutate(String operation,JSONObject request) throws Exception {
        String id=request.getString("playlist");
        switch(operation) {
            case "refresh":return refresh(id,request.optString("url"),request.optString("text"));
            case "legacyBegin":
                if(migration!=null)throw new IOException("Migração já iniciada.");
                if(summary(id).optBoolean("ready"))return new JSONObject().put("ready",true);
                migration=new Writer(id);return new JSONObject().put("ready",false);
            case "legacyAppend":
                if(migration==null || !migration.playlist.equals(id))throw new IOException("Migração não iniciada.");
                JSONArray batch=request.getJSONArray("items");if(batch.length()>256)throw new IOException("Lote de migração inválido.");
                try{for(int i=0;i<batch.length();i++)migration.accept(batch.getJSONObject(i));}
                catch(Exception e){migration.close();migration=null;throw e;}
                return new JSONObject().put("accepted",batch.length());
            case "legacyCommit":
                if(migration==null || !migration.playlist.equals(id))throw new IOException("Migração não iniciada.");
                try(Writer writer=migration){migration=null;return writer.commit(request.optString("guideUrl"),"","","",request.optString("url"));}
            case "legacyAbort":if(migration!=null){migration.close();migration=null;}return new JSONObject();
            case "delete":
                if(migration!=null)throw new IOException("A migração local ainda está em andamento.");
                getWritableDatabase().delete("libraries","id=?",new String[]{id});return new JSONObject();
            default:throw new IOException("Operação inválida.");
        }
    }
    Object read(String operation,JSONObject request) throws Exception {
        switch(operation){case "summary":return summary(request.getString("playlist"));case "page":return page(request);case "groups":return groups(request);case "seasons":return seasons(request);case "favorites":return favorites(request);case "guideChannels":return guideChannels(request);default:throw new IOException("Consulta inválida.");}
    }
    void abortMigration(){if(migration!=null){migration.close();migration=null;}}
}
