const ws = new WebSocket(`ws://localhost:${process.env.PORT}/ws`);

ws.addEventListener('message', (event) => {
	if (event.data === 'reload') {
		window.location.reload();
	}
});
