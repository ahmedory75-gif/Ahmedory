const https = require('https');

https.request('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', { method: 'HEAD' }, (res) => {
  console.log('SoundHelix headers:', res.headers);
}).end();

https.request('https://storage.googleapis.com/media-session/elephants-dream/the-wires.mp3', { method: 'HEAD' }, (res) => {
  console.log('Google headers:', res.headers);
}).end();
