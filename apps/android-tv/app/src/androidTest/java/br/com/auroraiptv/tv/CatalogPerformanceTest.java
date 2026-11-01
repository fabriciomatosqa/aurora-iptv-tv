package br.com.auroraiptv.tv;

import android.content.Context;
import android.os.*;
import android.os.Process;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import java.io.*;
import java.util.*;

/** Opt-in real Android matrix. Repository reads and warm WebView reloads are distinct metrics. */
@RunWith(AndroidJUnit4.class)
public class CatalogPerformanceTest {
    final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    interface Measured {void run()throws Exception;}
    void measure(JSONObject row,String name,Measured task)throws Exception{
        long start=SystemClock.elapsedRealtimeNanos(),cpu=Process.getElapsedCpuTime();task.run();
        row.getJSONObject("elapsed_ms").put(name,(SystemClock.elapsedRealtimeNanos()-start)/1_000_000.0);
        row.getJSONObject("cpu_ms").put(name,Process.getElapsedCpuTime()-cpu);row.getJSONObject("sampled_pss_kib").put(name,Debug.getPss());
    }
    static void generate(File file,int size,boolean extra)throws Exception{
        try(BufferedWriter out=new BufferedWriter(new FileWriter(file),65536)){
            out.write("#EXTM3U\n");for(int i=0;i<size+(extra?2:0);i++){
                boolean demo=i<15 || i>=size;String group=demo?"Séries":new String[]{"Canais","Filmes","Séries"}[i%3];
                String title=demo?"Benchmark Demo S01E"+String.format(Locale.ROOT,"%02d",i<size?i+1:i-size+16):i%3==0?"Canal "+i:i%3==1?"Filme "+i:"Série "+(i/30)+" S01E"+String.format(Locale.ROOT,"%02d",i%30+1);
                out.write("#EXTINF:-1 group-title=\""+group+"\","+title+"\nhttps://example.test/play/"+String.format(Locale.ROOT,"%064x",i)+"\n");
            }
        }
    }
    @Test public void measureMatrix()throws Exception{
        Bundle args=InstrumentationRegistry.getArguments();assumeTrue("true".equals(args.getString("catalogBenchmark")));
        String[] sizes=args.getString("catalogSizes","10000,100000,300000,600000,1200000").split(",");JSONArray results=new JSONArray();
        File input=new File(context.getCacheDir(),"tv-benchmark.m3u"),output=new File(context.getFilesDir(),"tv-catalog-benchmark.json");
        for(int index=0;index<sizes.length;index++){
            int size=Integer.parseInt(sizes[index]);String id="benchmark-"+size;CatalogStore store=new CatalogStore(context);
            store.getWritableDatabase().delete("libraries","id=?",new String[]{id});
            JSONObject row=new JSONObject().put("rows",size).put("elapsed_ms",new JSONObject()).put("cpu_ms",new JSONObject()).put("sampled_pss_kib",new JSONObject());results.put(row);
            try{
                generate(input,size,false);
                final CatalogStore initial=store;
                measure(row,"first_import",()->{try(Reader reader=new BufferedReader(new FileReader(input),65536)){assertEquals(size,initial.importReader(id,reader,"https://example.test/list").getInt("total"));}});
                store.close();store=new CatalogStore(context);final CatalogStore current=store;
                measure(row,"summary_reopen",()->assertTrue(current.summary(id).getBoolean("ready")));
                for(String kind:new String[]{"live","movies","series"})measure(row,"first_page_"+kind,()->{
                    JSONArray page=current.page(new JSONObject().put("playlist",id).put("kind",kind)).getJSONArray("items");assertTrue(page.length()>0&&page.length()<=48);
                    if(kind.equals("series"))for(int i=0;i<page.length();i++)assertFalse(page.getJSONObject(i).has("episodes"));
                });
                try(CatalogUiHarness ui=new CatalogUiHarness()){
                    boolean leave=index==sizes.length-1 && "true".equals(args.getString("catalogLeaveFixture"));
                    try{
                        JSONObject settings=CatalogUiTest.state(id,"Benchmark "+size,"");String key=id+"|https://example.test/play/"+String.format(Locale.ROOT,"%064x",15);
                        settings.getJSONArray("favorites").put(key);settings.getJSONObject("positions").put(key,21);
                        long start=SystemClock.elapsedRealtimeNanos();ui.seed(settings);
                        ui.waitFor("document.querySelector('.stat strong')?.textContent==='"+current.summary(id).getInt("live")+"' && document.querySelector('.card-title')?.textContent==='Canal 15'",30000);
                        row.getJSONObject("elapsed_ms").put("webview_active_playlist_ready",(SystemClock.elapsedRealtimeNanos()-start)/1_000_000.0);
                        for(String kind:new String[]{"live","movies","series"}){
                            String expected=kind.equals("live")?"Canal 15":kind.equals("movies")?"Filme 16":"Benchmark Demo";start=SystemClock.elapsedRealtimeNanos();
                            ui.click("[data-focus=nav-"+kind+"]");ui.waitFor("document.querySelectorAll('.card').length===48 && document.querySelector('.card-title')?.textContent==="+JSONObject.quote(expected),20000);
                            row.getJSONObject("elapsed_ms").put("visible_page_"+kind,(SystemClock.elapsedRealtimeNanos()-start)/1_000_000.0);
                        }
                        assertEquals("true",ui.js("JSON.parse(localStorage.getItem('aurora-tv-preview-v1')).positions["+JSONObject.quote(key)+"]===21"));
                        if(size<=100000){
                            // Original monolithic IndexedDB method, bounded to two smaller cases.
                            String baselineId="legacy-benchmark-"+size;
                            ui.js("window.__legacyResult=null; (async()=>{const db=await import('./src/core/catalog-db.mjs');const p=await import('./src/core/playlist.mjs');let items=Array.from({length:"+size+"},(_,i)=>({title:'Show '+Math.floor(i/30)+' S01E'+(i%30+1),group:'Séries',type:'series',url:'https://example.test/play/'+i,logo:'',tvgId:''}));await db.saveCatalog("+JSONObject.quote(baselineId)+",items);items=null;const start=performance.now();const loaded=await db.loadCatalog("+JSONObject.quote(baselineId)+");const groups=p.groupSeries(loaded);window.__legacyResult={read_and_group_ms:performance.now()-start,rows:loaded.length,shows:groups.length};await db.deletePlaylistData("+JSONObject.quote(baselineId)+");})().catch(e=>window.__legacyResult={error:String(e)});true");
                            ui.waitFor("window.__legacyResult!==null",90000);JSONObject baseline=new JSONObject(ui.js("window.__legacyResult"));assertFalse(baseline.toString(),baseline.has("error"));row.put("legacy_indexeddb",baseline);
                        }else row.put("legacy_indexeddb","Not repeated above 100k: old path materializes the full array. No measured large-size baseline claimed.");
                    }finally{if(!leave)ui.restore();}
                }
                measure(row,"unchanged_reimport",()->{try(Reader reader=new BufferedReader(new FileReader(input),65536)){JSONObject delta=current.importReader(id,reader,"https://example.test/list");assertEquals(0,delta.getInt("added"));assertEquals(0,delta.getInt("changed"));}});
                generate(input,size,true);
                measure(row,"two_episodes_added",()->{try(Reader reader=new BufferedReader(new FileReader(input),65536)){JSONObject delta=current.importReader(id,reader,"https://example.test/list");assertEquals(2,delta.getInt("added"));assertEquals(0,delta.getInt("changed"));assertEquals(size+2,delta.getInt("total"));}});
                JSONArray demo=current.page(new JSONObject().put("playlist",id).put("kind","series").put("search","Benchmark Demo")).getJSONArray("items");assertEquals(17,demo.getJSONObject(0).getInt("episodeCount"));
                row.put("database_bytes",context.getDatabasePath("android_catalog.db").length());long disk=0;for(String suffix:new String[]{"","-wal","-shm"})disk+=context.getDatabasePath("android_catalog.db"+suffix).length();row.put("database_with_wal_bytes",disk);
                row.put("network","Synthetic local input; remote gzip/304 and real playback are separate integration tests.");
                try(FileWriter writer=new FileWriter(output)){writer.write(results.toString(2));}
                android.util.Log.i("AuroraTvBenchmark",row.toString());
            }finally{
                if(!(index==sizes.length-1&&"true".equals(args.getString("catalogLeaveFixture"))))store.getWritableDatabase().delete("libraries","id=?",new String[]{id});store.close();input.delete();
            }
        }
    }
}
