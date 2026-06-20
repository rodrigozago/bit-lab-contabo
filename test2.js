const { exec } = require('child_process');
const server = exec('node api/server.js');
server.stdout.on('data', console.log);
server.stderr.on('data', console.error);
setTimeout(() => {
  exec('curl -s http://127.0.0.1:3001/api/listening', (err, stdout) => {
    console.log("1:", stdout);
    exec('curl -s -X POST http://127.0.0.1:3001/api/listening -H "Content-Type: application/json" -d \'{"password":"rz123456", "album": "The Dark Side of the Moon"}\'', (err, stdout) => {
      console.log("2:", stdout);
      exec('curl -s http://127.0.0.1:3001/api/listening', (err, stdout) => {
        console.log("3:", stdout);
        server.kill();
      });
    });
  });
}, 2000);
