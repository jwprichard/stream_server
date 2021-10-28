var express = require("express");
var http = require("http");
var WebSocket = require("ws");
var cors = require("cors");
var needle = require("needle");

// Import the natural analizers
const Analyzer = require("natural").SentimentAnalyzer;
const stemmer = require("natural").PorterStemmer;

var app = express();
var server = http.createServer(app);
var wss = new WebSocket.Server({ server: server });

require("dotenv").config();

wss.on("connection", (ws) => {
  console.log("connection");
});

app.use(cors());

function analizeText(data) {
  // Create a new Analyser
  var analyzer = new Analyzer("English", stemmer, "afinn");
  // Grab text from JSON and split into and array
  var textArray = data.text.split(" ");
  var sentiment = analyzer.getSentiment(textArray);
  data.sentiment = sentiment;
  return data;
}

function sendData(data, wss) {
  console.log("here");
  var clients = wss.clients;
  clients.forEach((client) => {
    console.log(data);
    client.send(JSON.stringify(data));
  });
}

// URL for connecting to the twitter stream.
const streamUrl = "https://api.twitter.com/2/tweets/search/stream";

function streamConnect(retryAttempt) {
  const stream = needle.get(streamUrl, {
    headers: {
      "User-Agent": "sampleStreamTest",
      Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
    },
    timeout: 20000,
  });

  stream
    .on("data", (data) => {
      try {
        const json = JSON.parse(data);

        var tweet = analizeText(json.data);
        //console.log(json);
        sendData(tweet, wss);
        //ws.send(JSON.stringify(json));
        retryAttempt = 0;
      } catch (err) {
        if (data.status === 401) {
          console.log(data);
          process.exit(1);
        } else if (
          data.detail ===
          "This stream is currently at the maximum allowed connection limit."
        ) {
          console.log(data.detail);
          process.exit(1);
        } else {
          //Do nothing
        }
      }
    })
    .on("err", (error) => {
      if (error.code !== "ECONNRESET") {
        console.log(error.code);
        process.exit(1);
      } else {
        setTimeout(() => {
          console.warn("A connection error occurred. Reconnecting...");
          streamConnect(++retryAttempt, ws);
        }, 2 ** retryAttempt);
      }
    });
  return stream;
}

app.use("/", function (req, res) {
  streamConnect(0);
  res.send("hey");
});

var port = normalizePort("8080");
app.set("port", port);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Listening on " + bind);
}
