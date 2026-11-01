package br.com.auroraiptv.tv;

import android.content.Context;
import android.database.Cursor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.GZIPOutputStream;

@RunWith(AndroidJUnit4.class)
public class CatalogStoreTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private CatalogStore store;
    static String rows(int n){StringBuilder text=new StringBuilder("#EXTM3U\n");for(int i=1;i<=n;i++)text.append("#EXTINF:-1 group-title=\"Séries\",Aurora S01E").append(String.format(Locale.ROOT,"%02d",i)).append("\nhttps://example.test/ep/").append(i).append("\n");return text.toString();}
    private JSONObject page(String kind)throws Exception{return new JSONObject().put("playlist","test").put("kind",kind);}
    @Before public void setup(){context.deleteDatabase("catalog-test.db");store=new CatalogStore(context,"catalog-test.db");}
    @After public void cleanup(){store.abortMigration();store.close();context.deleteDatabase("catalog-test.db");}

    @Test public void appendsWithoutDuplicatesKeepsOldRowsAndReadsEpisodesOnlyOnDemand()throws Exception{
        assertEquals(15,store.importReader("test",new StringReader(rows(15)),"https://example.test/list").getInt("total"));
        JSONObject delta=store.importReader("test",new StringReader(rows(17)),"https://example.test/list");
        assertEquals(2,delta.getInt("added"));assertEquals(0,delta.getInt("changed"));assertEquals(1,delta.getInt("series"));
        JSONObject directory=store.page(page("series")).getJSONArray("items").getJSONObject(0);
        assertFalse(directory.has("episodes"));assertEquals(17,directory.getInt("episodeCount"));assertEquals("Aurora",directory.getString("title"));
        JSONObject episodes=store.page(page("series").put("show",directory.getString("showKey")).put("limit",5));
        assertEquals(5,episodes.getJSONArray("items").length());assertTrue(episodes.getBoolean("more"));
        assertEquals(17,store.importReader("test",new StringReader(rows(2)),"https://example.test/list").getInt("total"));
        store.close();store=new CatalogStore(context,"catalog-test.db");assertTrue(store.summary("test").getBoolean("ready"));assertEquals(17,store.summary("test").getInt("total"));
        JSONObject favorites=store.favorites(page("series").put("keys",new JSONArray().put("series:Aurora")));
        assertEquals(1,favorites.getJSONArray("items").length());
    }
    @Test public void identicalImportsDoNotWriteCatalogRowsAndMetadataChangesKeepUrlIdentity()throws Exception{
        store.importReader("test",new StringReader(rows(15)),"https://example.test/list");
        store.getWritableDatabase().execSQL("CREATE TRIGGER reject_update BEFORE UPDATE ON entries BEGIN SELECT RAISE(ABORT,'unchanged row rewritten'); END");
        store.getWritableDatabase().execSQL("CREATE TRIGGER reject_insert BEFORE INSERT ON entries BEGIN SELECT RAISE(ABORT,'duplicate inserted'); END");
        assertEquals(0,store.importReader("test",new StringReader(rows(15)),"https://example.test/list").getInt("changed"));
        store.getWritableDatabase().execSQL("DROP TRIGGER reject_update");store.getWritableDatabase().execSQL("DROP TRIGGER reject_insert");
        JSONObject result=store.importReader("test",new StringReader(rows(15).replace("Aurora S01E01","Aurora Revisada S01E01")),"https://example.test/list");
        assertEquals(0,result.getInt("added"));assertEquals(1,result.getInt("changed"));assertEquals(15,result.getInt("total"));
    }
    @Test public void interruptedImportRollsBackRowsAndDirectory()throws Exception{
        store.importReader("test",new StringReader(rows(15)),"https://example.test/list");
        try(CatalogStore.Writer writer=store.new Writer("test")){
            CatalogParser.scan(new StringReader(rows(17)),"https://example.test/list",row->{writer.accept(row);if(row.getString("url").endsWith("/17"))throw new IOException("interrupted");});
            fail("Synthetic import must fail");
        }catch(IOException expected){}
        assertEquals(15,store.summary("test").getInt("total"));assertEquals(15,store.page(page("series")).getJSONArray("items").getJSONObject(0).getInt("episodeCount"));
        assertEquals(2,store.importReader("test",new StringReader(rows(17)),"https://example.test/list").getInt("added"));
    }
    @Test public void walReadersBrowseCommittedCatalogWhileImportTransactionIsHeld()throws Exception{
        store.importReader("test",new StringReader(rows(15)),"https://example.test/list");
        CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1);ExecutorService writer=Executors.newSingleThreadExecutor();
        Future<?> future=writer.submit(()->{try(CatalogStore.Writer transaction=store.new Writer("test")){
            CatalogParser.scan(new StringReader(rows(17)),"https://example.test/list",transaction::accept);held.countDown();
            if(!release.await(10,TimeUnit.SECONDS))throw new IOException("reader timed out");transaction.commit("","","","","");
        }catch(Exception e){throw new RuntimeException(e);}});
        try{assertTrue(held.await(10,TimeUnit.SECONDS));long start=System.nanoTime();
            assertEquals(15,store.summary("test").getInt("total"));assertEquals(15,store.page(page("series")).getJSONArray("items").getJSONObject(0).getInt("episodeCount"));
            assertTrue("Read must not wait for writer",(System.nanoTime()-start)/1_000_000<2000);
        }finally{release.countDown();future.get(10,TimeUnit.SECONDS);writer.shutdownNow();}
        assertEquals(17,store.summary("test").getInt("total"));
    }
    @Test public void migrationRollbackAndRestartPreserveExactLegacyTypesAndDistinctAccentedSeries()throws Exception{
        store.mutate("legacyBegin",page("series"));
        JSONArray batch=new JSONArray().put(new JSONObject().put("title","São.S01E01").put("group","Séries").put("type","series").put("url","https://example.test/sao1"))
            .put(new JSONObject().put("title","Sao S01E01").put("group","Séries").put("type","series").put("url","https://example.test/sao2"))
            .put(new JSONObject().put("title","Original").put("group","Mix").put("type","unknown").put("url","https://example.test/original"));
        store.mutate("legacyAppend",page("series").put("items",batch));store.mutate("legacyAbort",page("series"));assertFalse(store.summary("test").optBoolean("ready"));
        store.mutate("legacyBegin",page("series"));store.mutate("legacyAppend",page("series").put("items",batch));store.mutate("legacyCommit",page("series"));
        assertEquals(2,store.summary("test").getInt("series"));assertEquals(1,store.summary("test").getInt("unknown"));assertEquals(2,store.page(page("series")).getJSONArray("items").length());
        assertTrue(store.mutate("legacyBegin",page("series")).getBoolean("ready"));
    }
    @Test public void parentalFilterCoversEntireSeriesAndExactCategoryAndSearch()throws Exception{
        String text=rows(2)+"#EXTINF:-1 group-title=\"Séries +18\",Aurora S02E01\nhttps://example.test/adult\n#EXTINF:-1 group-title=\"Filmes\",Família, com vírgula\nhttps://example.test/movie\n";
        store.importReader("test",new StringReader(text),"https://example.test/list");
        assertEquals(0,store.page(page("series")).getJSONArray("items").length());
        assertEquals(1,store.page(page("series").put("unlocked",true)).getJSONArray("items").length());
        assertEquals(1,store.page(page("movies").put("group","Filmes").put("search","familia")).getJSONArray("items").length());
        assertEquals(0,store.page(page("movies").put("search","%_")).getJSONArray("items").length());
        assertEquals(1,store.seasons(page("series").put("show","aurora")).length());
        assertEquals(2,store.seasons(page("series").put("show","aurora").put("unlocked",true)).length());
    }
    @Test public void firstPagesUsePersistentIndexes()throws Exception{
        store.importReader("test",new StringReader(rows(100)),"https://example.test/list");
        try(Cursor c=store.getReadableDatabase().rawQuery("EXPLAIN QUERY PLAN SELECT json FROM entries WHERE playlist=? AND kind=? AND adult=0 ORDER BY id LIMIT 49",new String[]{"test","live"})){
            StringBuilder plan=new StringBuilder();while(c.moveToNext())plan.append(c.getString(3));assertTrue(plan.toString(),plan.toString().contains("entries_type"));assertFalse(plan.toString(),plan.toString().contains("SCAN TABLE entries"));
        }
    }
    static final class Reply implements AutoCloseable {
        final ServerSocket socket;final ExecutorService executor=Executors.newSingleThreadExecutor();final Future<?> future;volatile String request="";
        Reply(int status,byte[] body,String extra,long declared)throws Exception{
            socket=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"));
            future=executor.submit(()->{try(Socket client=socket.accept()){
                client.setSoTimeout(15000);BufferedReader in=new BufferedReader(new InputStreamReader(client.getInputStream(),StandardCharsets.ISO_8859_1));StringBuilder headers=new StringBuilder();String line;
                while((line=in.readLine())!=null&&!line.isEmpty())headers.append(line).append('\n');request=headers.toString();
                OutputStream out=client.getOutputStream();out.write(("HTTP/1.1 "+status+" OK\r\nConnection: close\r\nContent-Length: "+declared+"\r\n"+extra+"\r\n").getBytes(StandardCharsets.ISO_8859_1));out.write(body);out.flush();
            }catch(IOException e){throw new RuntimeException(e);}});
        }
        String url(){return "http://127.0.0.1:"+socket.getLocalPort()+"/list";}
        @Override public void close()throws Exception{socket.close();try{future.get(15,TimeUnit.SECONDS);}finally{executor.shutdownNow();}}
    }
    @Test public void gzipHttpAndConditionalValidationKeepOldCatalogAfterTruncation()throws Exception{
        byte[] plain=rows(15).getBytes(StandardCharsets.UTF_8);ByteArrayOutputStream buffer=new ByteArrayOutputStream();try(GZIPOutputStream zip=new GZIPOutputStream(buffer)){zip.write(plain);}byte[] gzip=buffer.toByteArray();
        // A stable server URL is required for conditional validators.
        try(Reply response=new Reply(200,gzip,"Content-Encoding: gzip\r\nETag: first\r\n",gzip.length)){
            JSONObject result=store.refresh("test",response.url(),"");assertEquals(15,result.getInt("total"));assertEquals(gzip.length,result.getLong("wireBytes"));
        }
        try(Reply response=new Reply(200,Arrays.copyOf(gzip,gzip.length-4),"Content-Encoding: gzip\r\n",gzip.length)){
            try{store.refresh("test",response.url(),"");fail("Truncated gzip must fail");}catch(IOException expected){}
        }
        assertEquals(15,store.summary("test").getInt("total"));assertTrue(store.summary("test").getBoolean("ready"));
        try(Reply response=new Reply(200,gzip,"Content-Encoding: gzip\r\n",gzip.length+100)){
            try{store.refresh("test",response.url(),"");fail("Missing declared bytes must fail");}catch(IOException expected){}
        }
        assertEquals(15,store.summary("test").getInt("total"));
    }
    @Test public void stableSourceUsesEtag304AndDecodedBodyFingerprint()throws Exception{
        ServerSocket socket=new ServerSocket(0,3,InetAddress.getByName("127.0.0.1"));ExecutorService server=Executors.newSingleThreadExecutor();List<String> requests=new ArrayList<>();
        byte[] plain=rows(15).getBytes(StandardCharsets.UTF_8);ByteArrayOutputStream buffer=new ByteArrayOutputStream();try(GZIPOutputStream gzip=new GZIPOutputStream(buffer)){gzip.write(plain);}byte[] compressed=buffer.toByteArray();
        Future<?> task=server.submit(()->{try{for(int i=0;i<3;i++)try(Socket client=socket.accept()){
            BufferedReader in=new BufferedReader(new InputStreamReader(client.getInputStream(),StandardCharsets.ISO_8859_1));StringBuilder request=new StringBuilder();String line;while((line=in.readLine())!=null&&!line.isEmpty())request.append(line).append('\n');requests.add(request.toString());
            byte[] body=i==0?plain:i==1?compressed:new byte[0];String extra=i==1?"Content-Encoding: gzip\r\nETag: second\r\n":"ETag: first\r\n";
            OutputStream out=client.getOutputStream();out.write(("HTTP/1.1 "+(i==2?304:200)+" OK\r\nConnection: close\r\nContent-Length: "+body.length+"\r\n"+extra+"\r\n").getBytes(StandardCharsets.ISO_8859_1));out.write(body);out.flush();
        }}catch(Exception e){throw new RuntimeException(e);}});
        try{
            String url="http://127.0.0.1:"+socket.getLocalPort()+"/list";
            assertEquals(15,store.refresh("test",url,"").getInt("added"));
            assertTrue(store.refresh("test",url,"").getBoolean("sameBody"));
            assertTrue(store.refresh("test",url,"").getBoolean("notModified"));task.get(15,TimeUnit.SECONDS);
            assertTrue(requests.get(1).toLowerCase(Locale.ROOT).contains("if-none-match: first"));assertTrue(requests.get(2).toLowerCase(Locale.ROOT).contains("if-none-match: second"));
            assertEquals(15,store.summary("test").getInt("total"));
        }finally{socket.close();server.shutdownNow();}
    }
}
