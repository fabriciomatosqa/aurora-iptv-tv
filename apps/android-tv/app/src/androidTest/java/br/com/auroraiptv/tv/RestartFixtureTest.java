package br.com.auroraiptv.tv;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import static org.junit.Assume.assumeTrue;
import java.util.UUID;
/** Independent restart-only fixture. Production parsing is measured in the full matrix. */
public class RestartFixtureTest {
    @Test public void seed()throws Exception{
        assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("restartFixture")));
        String id="restart-"+UUID.randomUUID();
        try(CatalogStore store=new CatalogStore(InstrumentationRegistry.getInstrumentation().getTargetContext())){
            android.database.sqlite.SQLiteDatabase db=store.getWritableDatabase();db.beginTransactionNonExclusive();
            try{
                db.execSQL("INSERT INTO libraries(id) VALUES(?)",new Object[]{id});
                db.execSQL("WITH RECURSIVE seq(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM seq WHERE n<1199999) INSERT INTO entries(playlist,url,kind,group_name,show_key,season,episode,adult,title_norm,guide_name,tvg,json) SELECT ?, 'https://example.test/live/'||n,'live','Canais','',0,0,0,'canal '||n,'canal '||n,'','{\"title\":\"Canal '||(CASE WHEN n=0 THEN 15 ELSE n END)||'\",\"group\":\"Canais\",\"type\":\"live\",\"url\":\"https://example.test/live/'||n||'\",\"stateKey\":\"https://example.test/live/'||n||'\"}' FROM seq",new Object[]{id});
                db.execSQL("UPDATE libraries SET ready=1,total=1200000,live=1200000 WHERE id=?",new Object[]{id});
                db.execSQL("INSERT INTO groups VALUES(?,'live','Canais',1200000,1200000)",new Object[]{id});
                db.setTransactionSuccessful();
            }finally{db.endTransaction();}
        }
        try(CatalogUiHarness ui=new CatalogUiHarness()){
            ui.seed(CatalogUiTest.state(id,"Restart fixture 1200000",""));
            ui.waitFor("document.querySelector('.stat strong')?.textContent==='1200000'",30000);
        }
    }
}
