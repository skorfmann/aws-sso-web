import express from "express";
import { createServer as createViteServer } from "vite";
import request from "request";
import bodyParser from "body-parser";

const port = 5173;
async function createServer() {
  const app = express();

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    server: { middlewareMode: true },
  });

  // use vite's connect instance as middleware
  // if you use your own express router (express.Router()), you should use router.use
  app.use(vite.middlewares);

  app.listen(port);

  console.log(`open http://127.0.0.1:${port}`);
}

createServer();

async function createSsoProxy() {
  const app = express();

  var myLimit =
    typeof process.argv[2] != "undefined" ? process.argv[2] : "100kb";
  app.use(bodyParser.json({ limit: myLimit }));

  app.all("*", function (req, res, next) {
    // Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
    res.header(
      "Access-Control-Allow-Headers",
      req.header("access-control-request-headers")
    );

    if (req.method === "OPTIONS") {
      // CORS Preflight
      res.send();
    } else {
      let headers = {
        "amz-sdk-invocation-id": req.header("amz-sdk-invocation-id"),
        "amz-sdk-request": req.header("amz-sdk-request"),
        "x-amz-user-agent": req.header("x-amz-user-agent"),
      };
      var targetURL = req.header("Target-URL"); // Target-URL ie. https://example.com or http://example.com
      if (req.header("x-amz-sso_bearer_token")) {
        // If the request has a bearer token, use it to make the request to the target URL
        headers["x-amz-sso_bearer_token"] = req.header(
          "x-amz-sso_bearer_token"
        );
      }

      if (!targetURL) {
        res.send(500, {
          error: "There is no Target-Endpoint header in the request",
        });
        return;
      }
      console.log({ haader: req.headers, body: req.body });
      // remove the trailing slash from the targetURL if it exists
      const url = (targetURL + req.url).replace(/\/$/, "");

      const options = {
        url,
        method: req.method,
        headers: headers,
        json: req.body,
      };

      console.log(targetURL + req.url);
      request(options, function (error, response, body) {
        if (error) {
          console.error(error);
          console.error("error: " + response.statusCode);
        }
        console.log({ status: response.statusCode, response: body });
      }).pipe(res);
    }
  });

  app.set("port", 5174);

  app.listen(app.get("port"), function () {
    console.log("Proxy server listening on port " + app.get("port"));
  });
}

createSsoProxy();
