#include <napi.h>
#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <AppKit/AppKit.h>

// Function to get the actual dock bounds and screen info
Napi::Object GetScreenInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Get main screen bounds
    CGRect screenBounds = CGDisplayBounds(CGMainDisplayID());
    
    // Get dock info using AppKit APIs
    NSScreen* mainScreen = [NSScreen mainScreen];
    NSRect visibleFrame = [mainScreen visibleFrame];
    NSRect fullFrame = [mainScreen frame];
    
    // Calculate dock height
    CGFloat dockHeight = fullFrame.size.height - visibleFrame.size.height - visibleFrame.origin.y;
    
    Napi::Object result = Napi::Object::New(env);
    
    // Screen bounds
    Napi::Object screen = Napi::Object::New(env);
    screen.Set("x", Napi::Number::New(env, screenBounds.origin.x));
    screen.Set("y", Napi::Number::New(env, screenBounds.origin.y));
    screen.Set("width", Napi::Number::New(env, screenBounds.size.width));
    screen.Set("height", Napi::Number::New(env, screenBounds.size.height));
    
    // Visible area (without dock/menu bar)
    Napi::Object visible = Napi::Object::New(env);
    visible.Set("x", Napi::Number::New(env, visibleFrame.origin.x));
    visible.Set("y", Napi::Number::New(env, visibleFrame.origin.y));
    visible.Set("width", Napi::Number::New(env, visibleFrame.size.width));
    visible.Set("height", Napi::Number::New(env, visibleFrame.size.height));
    
    result.Set("screen", screen);
    result.Set("visible", visible);
    result.Set("dockHeight", Napi::Number::New(env, dockHeight));
    
    return result;
}

// Function to force window to cover dock using native APIs
Napi::Boolean ForceWindowOverDock(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    // Get parameters
    int windowId = info[0].As<Napi::Number>().Int32Value();
    double x = info[1].As<Napi::Number>().DoubleValue();
    double y = info[2].As<Napi::Number>().DoubleValue();
    double width = info[3].As<Napi::Number>().DoubleValue();
    double height = info[4].As<Napi::Number>().DoubleValue();
    
    @autoreleasepool {
        // Find the NSWindow from the window ID
        NSArray* windows = [NSApp windows];
        NSWindow* targetWindow = nil;
        
        for (NSWindow* window in windows) {
            if ([window windowNumber] == windowId) {
                targetWindow = window;
                break;
            }
        }
        
        if (!targetWindow) {
            return Napi::Boolean::New(env, false);
        }
        
        // Set window level to be above dock - this is the key!
        [targetWindow setLevel:kCGDockWindowLevel + 1];
        
        // Force window frame to exact position
        NSRect frame = NSMakeRect(x, y, width, height);
        [targetWindow setFrame:frame display:YES animate:NO];
        
        // Additional properties to ensure it stays on top
        [targetWindow setCollectionBehavior:NSWindowCollectionBehaviorCanJoinAllSpaces | 
                                           NSWindowCollectionBehaviorStationary |
                                           NSWindowCollectionBehaviorIgnoresCycle];
        
        // Force the window to be non-movable and always on top
        [targetWindow setMovable:NO];
        
        return Napi::Boolean::New(env, true);
    }
}

// Initialize the addon
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("getScreenInfo", Napi::Function::New(env, GetScreenInfo));
    exports.Set("forceWindowOverDock", Napi::Function::New(env, ForceWindowOverDock));
    
    return exports;
}

NODE_API_MODULE(macos_window_manager, Init)