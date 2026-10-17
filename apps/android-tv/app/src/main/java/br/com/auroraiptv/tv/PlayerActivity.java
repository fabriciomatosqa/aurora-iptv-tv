package br.com.auroraiptv.tv;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class PlayerActivity extends Activity {
    private ExoPlayer player;
    private boolean finishedVideo = false;
    private String key = "";
    private TextView errorLabel;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        String url = getIntent().getStringExtra("url");
        key = getIntent().getStringExtra("key");
        if (key == null) key = "";
        if (url == null || url.isEmpty()) { finish(); return; }
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(0xff02060c);
        PlayerView playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setControllerShowTimeoutMs(5000);
        frame.addView(playerView, new FrameLayout.LayoutParams(-1, -1));
        errorLabel = new TextView(this);
        errorLabel.setTextColor(0xfff0faff);
        errorLabel.setTextSize(20);
        errorLabel.setPadding(28, 16, 28, 16);
        errorLabel.setBackgroundColor(0xc01e3040);
        errorLabel.setVisibility(View.GONE);
        FrameLayout.LayoutParams errorParams = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        frame.addView(errorLabel, errorParams);
        setContentView(frame);
        playerView.requestFocus();
        try {
            player = new ExoPlayer.Builder(this).build();
            playerView.setPlayer(player);
            player.addListener(new Player.Listener() {
                @Override public void onPlayerError(PlaybackException error) {
                    errorLabel.setText("Não foi possível reproduzir esta transmissão. Verifique o formato, a conexão e os codecs da TV.");
                    errorLabel.setVisibility(View.VISIBLE);
                }
                @Override public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_ENDED) finishedVideo = true;
                }
            });
            MediaItem.Builder item = new MediaItem.Builder().setUri(Uri.parse(url));
            String lower = url.toLowerCase(java.util.Locale.ROOT);
            if (lower.contains(".m3u8") || lower.contains("output=hls")) item.setMimeType(MimeTypes.APPLICATION_M3U8);
            else if (lower.contains(".mpd")) item.setMimeType(MimeTypes.APPLICATION_MPD);
            else if (lower.contains(".ts") || lower.contains("output=mpegts")) item.setMimeType(MimeTypes.VIDEO_MP2T);
            player.setMediaItem(item.build());
            player.prepare();
            long resume = getIntent().getLongExtra("resumeMs", 0L);
            if (resume > 0) player.seekTo(resume);
            player.play();
        } catch (Exception ignored) {
            errorLabel.setText("Falha ao iniciar o player. Pressione Voltar.");
            errorLabel.setVisibility(View.VISIBLE);
        }
    }
    private void finishWithPosition() {
        long position = player != null ? Math.max(0, player.getCurrentPosition()) : 0;
        Intent result = new Intent();
        result.putExtra("key", key);
        result.putExtra("positionMs", position);
        result.putExtra("ended", finishedVideo);
        setResult(RESULT_OK, result);
        finish();
    }
    @Override public void onBackPressed() { finishWithPosition(); }
    @Override protected void onStop() {
        if (player != null) {
            // Preserve position also when home/system closes the player unexpectedly.
            Intent result = new Intent();
            result.putExtra("key", key);
            result.putExtra("positionMs", Math.max(0, player.getCurrentPosition()));
            result.putExtra("ended", finishedVideo);
            setResult(RESULT_OK, result);
            player.release();
            player = null;
        }
        super.onStop();
    }
}
