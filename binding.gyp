{
  "targets": [
    {
      "target_name": "macos_window_manager",
      "sources": [ "src/native/macos_window_manager.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!@(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CFLAGS": [
              "-ObjC++"
            ]
          },
          "link_settings": {
            "libraries": [
              "-framework CoreFoundation",
              "-framework CoreGraphics", 
              "-framework AppKit"
            ]
          }
        }]
      ]
    }
  ]
}