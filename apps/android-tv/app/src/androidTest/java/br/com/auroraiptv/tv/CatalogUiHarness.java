package br.com.auroraiptv.tv;

import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import org.json.JSONObject;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

final class CatalogUiHarness implements AutoCloseable {
    final ActivityScenario<MainActivity> scenario;
    String previous;
    CatalogUiHarness()throws Exception{
        scenario=ActivityScenario.launch(MainActivity.class);
        waitFor("document.readyState==='complete' && typeof window.auroraCatalogResponse==='function'",30000);
        previous=js("localStorage.getItem('aurora-tv-preview-v1')");
    }
    String js(String source)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->{WebView view=(WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);view.evaluateJavascript(source,value->{result.set(value);latch.countDown();});});
        assertTrue("WebView did not answer",latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    void waitFor(String expression,long timeout)throws Exception{
        long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeout);
        while(System.nanoTime()<deadline){if("true".equals(js("Boolean("+expression+")")))return;Thread.sleep(50);}
        fail("WebView condition timed out: "+expression+"; body="+js("document.body.innerText.slice(-1200)"));
    }
    void seed(JSONObject state)throws Exception{
        js("localStorage.setItem('aurora-tv-preview-v1',"+JSONObject.quote(state.toString())+");true");reload();
    }
    void reload()throws Exception{
        String token=java.util.UUID.randomUUID().toString();
        js("window.__oldCatalogDocument="+JSONObject.quote(token)+";setTimeout(()=>location.reload(),0);true");
        waitFor("window.__oldCatalogDocument!=="+JSONObject.quote(token)+" && document.readyState==='complete' && typeof window.auroraCatalogResponse==='function'",30000);
    }
    void click(String selector)throws Exception{js("document.querySelector("+JSONObject.quote(selector)+").click();true");}
    void restore()throws Exception{
        js(previous==null || previous.equals("null")?"localStorage.removeItem('aurora-tv-preview-v1');true":"localStorage.setItem('aurora-tv-preview-v1',"+previous+");true");
    }
    @Override public void close(){scenario.close();}
}
