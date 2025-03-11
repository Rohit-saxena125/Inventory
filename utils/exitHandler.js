const exitHandler = (server, options = { coredump: false, timeout: 500 }) => {
  const exit = (code) => {
    options.coredump ? process.abort() : process.exit(code);
  };

  return (code, reason) => (err, promise) => {
    if (err && err instanceof Error) {
      console.error('Error while shutting down:', err);
    }

    // Attempt a graceful shutdown
    console.log(
      `Server shutting down with exit code: ${code}, reason: ${reason}`
    );
    server.close(() => {
      exit(code);
    });
    setTimeout(exit, options.timeout).unref();
  };
};

module.exports = exitHandler;
