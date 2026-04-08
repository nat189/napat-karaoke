package com.example.karaokeplus

import android.net.http.SslError
import android.os.*
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var myWebView: WebView
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 🔥 กันหน้าจอดับ
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 🔥 สร้าง WebView
        myWebView = WebView(this)

        val webSettings = myWebView.settings

        // ✅ พื้นฐาน
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true

        // ✅ ปรับให้เหมาะกับ TV / Tablet
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        webSettings.setSupportZoom(false)
        webSettings.builtInZoomControls = false
        webSettings.displayZoomControls = false

        // ✅ autoplay
        webSettings.mediaPlaybackRequiresUserGesture = false

        // ✅ performance
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT

        // 🔥 รองรับรีโมท
        myWebView.isFocusable = true
        myWebView.isFocusableInTouchMode = true
        myWebView.requestFocus()

        // 🔥 WebViewClient
        myWebView.webViewClient = object : WebViewClient() {

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                val url = error?.url ?: ""

                if (url.contains("kara.oke.dpdns.org")) {
                    handler?.proceed()
                } else {
                    handler?.cancel()
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)

                // 🔁 reload ทุก 2 ชั่วโมง
                handler.postDelayed({
                    myWebView.reload()
                }, 2 * 60 * 60 * 1000)
            }
        }

        // 🔥 debug web (ปิดได้ตอน production)
        WebView.setWebContentsDebuggingEnabled(true)

        // 🌐 โหลดเว็บหรือ restore state
        if (savedInstanceState != null) {
            myWebView.restoreState(savedInstanceState)
        } else {
            myWebView.loadUrl("https://kara.oke.dpdns.org/display.html")
        }

        setContentView(myWebView)

        // 🔙 back button
        val callback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (myWebView.canGoBack()) {
                    myWebView.goBack()
                } else {
                    finish()
                }
            }
        }
        onBackPressedDispatcher.addCallback(this, callback)
    }

    // 🎮 รองรับรีโมท
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                myWebView.dispatchKeyEvent(event)
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    // 🔄 เก็บ state กัน reload ตอนหมุนจอ
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        myWebView.saveState(outState)
    }

    // 🔋 lifecycle ป้องกันค้าง
    override fun onPause() {
        super.onPause()
        myWebView.onPause()
    }

    override fun onResume() {
        super.onResume()
        myWebView.onResume()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        myWebView.destroy()
    }
}
