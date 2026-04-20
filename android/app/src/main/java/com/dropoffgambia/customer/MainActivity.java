package com.dropoffgambia.customer;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Hide the Android Navigation Bar (Docker) while keeping the Status Bar visible
        hideNavigationBar();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideNavigationBar();
        }
    }

    private void hideNavigationBar() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                // Hide only the navigation bars (bottom), keeping status bars (top)
                controller.hide(WindowInsets.Type.navigationBars());
                // Make it reappear on swipe and hide again automatically
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            // Fallback for older Android versions
            int uiOptions = View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            
            // Note: We do NOT include SYSTEM_UI_FLAG_FULLSCREEN to keep the Status Bar visible
            getWindow().getDecorView().setSystemUiVisibility(uiOptions);
        }
    }
}
