process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e); });
process.on('unhandledRejection', (r) => { console.error('UNHANDLED:', r); });
process.on('SIGTERM', (s) => { console.error('GOT SIGTERM:', s); });
process.on('SIGINT', (s) => { console.error('GOT SIGINT:', s); });
process.on('SIGHUP', (s) => { console.error('GOT SIGHUP:', s); });
process.on('exit', (code) => { console.error('EXIT CODE:', code); });

require('./.next/standalone/server.js');
