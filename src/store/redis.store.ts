import Redis, { RedisOptions } from "ioredis";
const REDIS_CONNECT_TIMEOUT = 10000;
let connectionTimeout: NodeJS.Timeout;

export class RedisStore {
  private prefix: string;
  private redisClient: Redis;

  constructor(prefix: string);
  constructor(prefix: string, path: string);
  constructor(prefix: string, port: number);
  constructor(prefix: string, options: RedisOptions);
  constructor(prefix: string, port: number, host: string);
  constructor(prefix: string, port: number, options: RedisOptions);
  constructor(prefix: string, path: string, options: RedisOptions);
  constructor(
    prefix: string,
    port: number,
    host: string,
    options: RedisOptions
  );

  constructor(
    prefix: string,
    arg2?: string | number | RedisOptions,
    arg3?: string | RedisOptions,
    arg4?: RedisOptions
  ) {
    this.prefix = prefix;
    if (typeof arg2 == "string") {
      if (typeof arg3 == "object") {
        this.redisClient = new Redis(arg2, arg3);
      } else {
        this.redisClient = new Redis(arg2);
      }
    } else if (typeof arg2 == "number") {
      if (typeof arg3 == "string") {
        if (typeof arg4 == "object") {
          this.redisClient = new Redis(arg2, arg3, arg4);
        } else {
          this.redisClient = new Redis(arg2, arg3);
        }
      } else if (typeof arg3 == "object") {
        this.redisClient = new Redis(arg2, arg3);
      } else {
        this.redisClient = new Redis(arg2);
      }
    } else if (typeof arg2 == "object") {
      this.redisClient = new Redis(arg2);
    } else {
      this.redisClient = new Redis();
    }

    this.handleEventConnect();
    process.on("SIGINT", () => {
      this.redisClient.disconnect();
    });
  }

  private handleEventConnect() {
    this.redisClient.on("connect", () => {
      console.log("Redis connection status: connected");
      clearTimeout(connectionTimeout);
    });
    this.redisClient.on("end", () => {
      console.log("Redis connection status: disconnected");
      this.handleTimeoutError();
    });
    this.redisClient.on("reconnecting", () => {
      console.log("Redis connection status: reconnecting");
      clearTimeout(connectionTimeout);
    });
    this.redisClient.on("error", (err) => {
      console.log(`Redis connection status: error ${err}`);
      this.handleTimeoutError();
    });
  }

  private handleTimeoutError() {
    connectionTimeout = setTimeout(() => {
      throw new Error("Redis reconnect timed out");
    }, REDIS_CONNECT_TIMEOUT);
  }
}

type ExampleParams =
  | { prefix: string }
  | { prefix: string; path: string }
  | { prefix: string; port: number }
  | { prefix: string; options: RedisOptions }
  | { prefix: string; port: number; host: string }
  | { prefix: string; path: string; options: RedisOptions }
  | { prefix: string; port: number; options: RedisOptions }
  | { prefix: string; port: number; host: string; options: RedisOptions };

export class RedisStore1 {
  private prefix: string;
  private redisClient: Redis;

  constructor(params: { prefix: string });
  constructor(params: { prefix: string; path: string });
  constructor(params: { prefix: string; port: number });
  constructor(params: { prefix: string; options: RedisOptions });
  constructor(params: { prefix: string; port: number; host: string });
  constructor(params: { prefix: string; path: string; options: RedisOptions });
  constructor(params: { prefix: string; port: number; options: RedisOptions });
  constructor(params: {
    prefix: string;
    port: number;
    host: string;
    options: RedisOptions;
  });

  constructor(params: ExampleParams) {
    this.prefix = params.prefix;
    if ("path" in params) {
      if ("options" in params) {
        this.redisClient = new Redis(params.path, params.options);
      } else {
        this.redisClient = new Redis(params.path);
      }
    } else if ("port" in params) {
      if ("host" in params) {
        if ("options" in params) {
          this.redisClient = new Redis(
            params.port,
            params.host,
            params.options
          );
        } else {
          this.redisClient = new Redis(params.port, params.host);
        }
      } else if ("options" in params) {
        this.redisClient = new Redis(params.port, params.options);
      } else {
        this.redisClient = new Redis(params.port);
      }
    } else if ("options" in params) {
      this.redisClient = new Redis(params.options);
    } else {
      this.redisClient = new Redis();
    }
    this.handleEventConnect();
    process.on("SIGINT", () => {
      this.redisClient.disconnect();
    });
  }
  private handleEventConnect() {
    this.redisClient.on("connect", () => {
      console.log("Redis connection status: connected");
      clearTimeout(connectionTimeout);
    });
    this.redisClient.on("end", () => {
      console.log("Redis connection status: disconnected");
      this.handleTimeoutError();
    });
    this.redisClient.on("reconnecting", () => {
      console.log("Redis connection status: reconnecting");
      clearTimeout(connectionTimeout);
    });
    this.redisClient.on("error", (err) => {
      console.log(`Redis connection status: error ${err}`);
      this.handleTimeoutError();
    });
  }

  private handleTimeoutError() {
    connectionTimeout = setTimeout(() => {
      throw new Error("Redis reconnect timed out");
    }, REDIS_CONNECT_TIMEOUT);
  }
}

// const aa = new RedisStore("er", {
//   port: 6379, // Redis port
//   host: "127.0.0.1", // Redis host
//   username: "default", // needs Redis >= 6
//   password: "my-top-secret",
//   db: 0, // Defaul
// });
