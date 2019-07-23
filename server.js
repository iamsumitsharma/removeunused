const express = require('express')
const app = express();
const request = require('request');
const fetch  = require("node-fetch");

import './Untitled-2';

 import './testFile';

app.listen(7900, () => {
    console.log('server Up and running');
})

app.get('/test', async (_req, _res, _next) => {
    fetch('https://github.com/')
  .then(res => res.text())
})



app.get('/getDetails', async (_req, res, _next) => {

    request('https://demo.ghost.io/ghost/api/v2/content/tags?include=tags,authors&key=22444f78447824223cefc48062',
    (err, _resp, body) => {
        if (err) { return console.log(err); }
        return res.json(body);
      });
})



app.stop