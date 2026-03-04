// hmr.ts
var ws = new WebSocket(`ws://localhost:${process.env.PORT}/ws`);
ws.addEventListener("message", (event) => {
  if (event.data === "reload") {
    window.location.reload();
  }
});

//# debugId=370907858FE4D63664756E2164756E21
//# sourceMappingURL=./chunk-gvrj9hvc.js.map
