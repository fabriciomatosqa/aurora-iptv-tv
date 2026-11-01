package br.com.auroraiptv.tv;

import android.content.Context;
import android.os.SystemClock;
import android.view.KeyEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.net.*;
import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.common.Player;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

@RunWith(AndroidJUnit4.class)
public class CatalogUiTest {
    final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    static JSONObject state(String id,String name,String source)throws Exception{
        return new JSONObject().put("playlists",new JSONArray().put(new JSONObject().put("id",id).put("name",name).put("url",source))).put("activeId",id)
            .put("favorites",new JSONArray()).put("positions",new JSONObject()).put("recent",new JSONArray()).put("theme","dark");
    }
    @Test public void dpadReadsBeyond180SearchesWholeStoreAndKeepsBookmarksAfterReopen()throws Exception{
        String id="ui-"+UUID.randomUUID();CatalogStore store=new CatalogStore(context);
        StringBuilder body=new StringBuilder("#EXTM3U\n");for(int i=0;i<1000;i++)body.append("#EXTINF:-1 group-title=\"Filmes\",Movie ").append(i).append("\nhttps://example.test/movie/").append(i).append("\n");
        body.append(CatalogStoreTest.rows(120).substring(8));store.importReader(id,new StringReader(body.toString()),"https://example.test/list");
        String key=id+"|https://example.test/movie/5";JSONObject settings=state(id,"UI fixture","");settings.getJSONArray("favorites").put(key);settings.getJSONObject("positions").put(key,45);
        try(CatalogUiHarness ui=new CatalogUiHarness()){
            try{
                ui.seed(settings);ui.waitFor("document.querySelector('.stat strong')?.textContent==='0' && document.querySelectorAll('.card').length>0",30000);
                ui.js("document.querySelector('[data-focus=nav-movies]').focus();true");
                UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressKeyCode(KeyEvent.KEYCODE_DPAD_CENTER);
                ui.waitFor("document.querySelectorAll('.card').length===48 && document.querySelector('.card-title')?.textContent==='Movie 0'",15000);
                for(int i=1;i<=4;i++) {ui.click("[data-action=android-next]");ui.waitFor("document.querySelectorAll('.card').length===48 && document.querySelector('.card-title')?.textContent==='Movie "+(i*48)+"'",15000);}
                ui.js("let input=document.querySelector('[data-input=search]');input.value='Movie 999';input.dispatchEvent(new Event('input',{bubbles:true}));true");
                ui.waitFor("document.querySelectorAll('.card').length===1 && document.querySelector('.card-title')?.textContent==='Movie 999'",15000);
                ui.click("[data-focus=nav-series]");ui.waitFor("document.querySelectorAll('.card').length===1 && document.querySelector('.card-title')?.textContent==='Aurora'",15000);
                ui.click(".card");ui.waitFor("document.querySelectorAll('.card').length===48 && document.querySelector('[data-input=android-season]')",15000);
                assertEquals("true",ui.js("JSON.parse(localStorage.getItem('aurora-tv-preview-v1')).positions["+JSONObject.quote(key)+"]===45"));
                ui.reload();ui.waitFor("document.querySelectorAll('.stat').length===4 && document.querySelectorAll('.card').length>0",30000);
                ui.click("[data-focus=nav-favorites]");ui.waitFor("document.querySelectorAll('.card').length===1 && document.querySelector('.card-title')?.textContent==='Movie 5'",15000);
                UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(new File(context.getFilesDir(),"tv-paged-catalog.png"));
            }finally{ui.restore();}
        }finally{store.getWritableDatabase().delete("libraries","id=?",new String[]{id});store.close();}
    }
    @Test public void cachedVideoStartsBeforeHeldRemoteUpdateResponds()throws Exception{
        String id="playback-"+UUID.randomUUID();CountDownLatch requested=new CountDownLatch(1),release=new CountDownLatch(1);
        ExecutorService server=Executors.newFixedThreadPool(2);ServerSocket remote=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1")),video=new ServerSocket(0,4,InetAddress.getByName("127.0.0.1"));
        byte[] media;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("catalog-fixture.mp4");ByteArrayOutputStream buffer=new ByteArrayOutputStream()){byte[] bytes=new byte[65536];int n;while((n=in.read(bytes))!=-1)buffer.write(bytes,0,n);media=buffer.toByteArray();}
        Future<?> remoteTask=server.submit(()->{try(Socket client=remote.accept()){
            BufferedReader in=new BufferedReader(new InputStreamReader(client.getInputStream()));String line;while((line=in.readLine())!=null&&!line.isEmpty()){}requested.countDown();
            if(!release.await(40,TimeUnit.SECONDS))throw new IOException("video did not start");client.getOutputStream().write("HTTP/1.1 503 Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n".getBytes("UTF-8"));
        }catch(Exception e){throw new RuntimeException(e);}});
        Future<?> videoTask=server.submit(()->{try{while(!Thread.currentThread().isInterrupted())try(Socket client=video.accept()){
            BufferedReader in=new BufferedReader(new InputStreamReader(client.getInputStream()));String line;while((line=in.readLine())!=null&&!line.isEmpty()){}
            OutputStream out=client.getOutputStream();out.write(("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nConnection: close\r\nContent-Length: "+media.length+"\r\n\r\n").getBytes("UTF-8"));out.write(media);out.flush();
        }}catch(IOException ignored){}});
        CatalogStore store=new CatalogStore(context);String source="http://127.0.0.1:"+remote.getLocalPort()+"/update",url="http://127.0.0.1:"+video.getLocalPort()+"/fixture.mp4";
        store.importReader(id,new StringReader("#EXTM3U\n#EXTINF:-1 group-title=\"Canais\",Cached Video\n"+url+"\n"),source);
        JSONObject result=new JSONObject();long started=0;
        try(CatalogUiHarness ui=new CatalogUiHarness()){
            try{
                ui.seed(state(id,"Cached playback",source));assertTrue("Remote refresh was not requested",requested.await(20,TimeUnit.SECONDS));
                assertFalse(remoteTask.isDone());ui.click("[data-focus=nav-live]");ui.waitFor("document.querySelector('.card-title')?.textContent==='Cached Video'",15000);
                started=SystemClock.elapsedRealtime();ui.click(".card");AtomicBoolean playing=new AtomicBoolean();
                long deadline=SystemClock.elapsedRealtime()+15000;
                while(SystemClock.elapsedRealtime()<deadline && !playing.get()){
                    InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{for(android.app.Activity activity:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))if(activity instanceof PlayerActivity)try{
                        Field field=PlayerActivity.class.getDeclaredField("player");field.setAccessible(true);ExoPlayer player=(ExoPlayer)field.get(activity);if(player!=null && player.getPlaybackState()==Player.STATE_READY && player.isPlaying() && player.getCurrentPosition()>100)playing.set(true);
                    }catch(ReflectiveOperationException e){throw new RuntimeException(e);}});Thread.sleep(50);
                }
                assertTrue("Real video did not play",playing.get());assertFalse("Update responded before playback",remoteTask.isDone());
                result.put("video_start_ms",SystemClock.elapsedRealtime()-started).put("remote_response_still_held",true);
                UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack();ui.waitFor("document.querySelector('.card-title')?.textContent==='Cached Video'",15000);
                try(FileWriter writer=new FileWriter(new File(context.getFilesDir(),"tv-cache-first-playback.json"))){writer.write(result.toString(2));}
            }finally{release.countDown();ui.restore();}
        }finally{release.countDown();remote.close();video.close();remoteTask.get(20,TimeUnit.SECONDS);videoTask.cancel(true);server.shutdownNow();store.getWritableDatabase().delete("libraries","id=?",new String[]{id});store.close();}
    }
}
