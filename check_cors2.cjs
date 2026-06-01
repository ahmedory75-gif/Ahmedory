const https = require('https');

https.request('https://s3-us-west-2.amazonaws.com/s.cdpn.io/858/outfoxing.mp3', { method: 'HEAD' }, (res) => {
  console.log('CodePen headers:', res.headers);
}).end();

https.request('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3', { method: 'HEAD' }, (res) => {
  console.log('Pixabay headers:', res.headers);
}).end();
