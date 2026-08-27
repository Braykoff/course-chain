import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

// We import Font Awesome's stylesheet above, so tell the core library not to
// inject its own <style> tag at runtime. Without this, server-rendered icons
// flash at full size before the runtime CSS loads. Import this module once,
// from the root layout.
config.autoAddCss = false;
