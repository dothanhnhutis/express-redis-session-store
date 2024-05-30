import { RequestHandler as Middleware, CookieOptions, Request } from "express";
import { Redis, RedisOptions } from "ioredis";
import crypto from "crypto";
import { parse } from "cookie";
import { decrypt, encrypt } from "@/utils/helper";

// --------------------------- RedisStore ----------------------------
const REDIS_CONNECT_TIMEOUT = 10000;
let connectionTimeout: NodeJS.Timeout;

type RedisClientType =
  | { path: string }
  | { port: number }
  | { options: RedisOptions }
  | { port: number; host: string }
  | { path: string; options: RedisOptions }
  | { port: number; options: RedisOptions }
  | { port: number; host: string; options: RedisOptions };

type RedisStoreType = {
  prefix: string;
  client: RedisClientType;
};

export class RedisStore {
  public prefix: string;
  private client: Redis;

  constructor(params: { prefix: string });
  constructor(params: { prefix: string; client: { path: string } });
  constructor(params: { prefix: string; client: { port: number } });
  constructor(params: { prefix: string; client: { options: RedisOptions } });
  constructor(params: {
    prefix: string;
    client: { port: number; host: string };
  });
  constructor(params: {
    prefix: string;
    client: { path: string; options: RedisOptions };
  });
  constructor(params: {
    prefix: string;
    client: { port: number; options: RedisOptions };
  });
  constructor(params: {
    prefix: string;
    client: {
      port: number;
      host: string;
      options: RedisOptions;
    };
  });

  constructor(params: RedisStoreType) {
    this.prefix = params.prefix;
    if (params.client) {
      const config = params.client;
      if ("path" in config) {
        if ("options" in config) {
          this.client = new Redis(config.path, config.options);
        } else {
          this.client = new Redis(config.path);
        }
      } else if ("port" in config) {
        if ("host" in config) {
          if ("options" in config) {
            this.client = new Redis(config.port, config.host, config.options);
          } else {
            this.client = new Redis(config.port, config.host);
          }
        } else if ("options" in config) {
          this.client = new Redis(config.port, config.options);
        } else {
          this.client = new Redis(config.port);
        }
      } else if ("options" in config) {
        this.client = new Redis(config.options);
      } else {
        this.client = new Redis();
      }
    } else {
      // inplement base store
      this.client = new Redis();
    }
    this.handleEventConnect();
    process.on("SIGINT", () => {
      this.client.disconnect();
    });
  }
  private handleEventConnect() {
    this.client.on("connect", () => {
      console.log("Redis connection status: connected");
      clearTimeout(connectionTimeout);
    });
    this.client.on("end", () => {
      console.log("Redis connection status: disconnected");
      this.handleTimeoutError();
    });
    this.client.on("reconnecting", () => {
      console.log("Redis connection status: reconnecting");
      clearTimeout(connectionTimeout);
    });
    this.client.on("error", (err) => {
      console.log(`Redis connection status: error ${err}`);
      this.handleTimeoutError();
    });
  }
  private handleTimeoutError() {
    connectionTimeout = setTimeout(() => {
      throw new Error("Redis reconnect timed out");
    }, REDIS_CONNECT_TIMEOUT);
  }

  public set(key: string, value: string, maxAge?: number): void {
    if (maxAge) {
      this.client.set(key, value, "PX", maxAge, (err, data) => {
        if (err) throw new Error(err.message);
        return data == "OK";
      });
    } else {
      this.client.set(key, value, (err, data) => {
        if (err) throw new Error(err.message);
        return data == "OK";
      });
    }
  }
  public get(key: string): Promise<string | null> {
    return this.client.get(key, (err, data) => {
      if (err) throw new Error(err.message);
      return data == "OK";
    });
  }
  public delete(pattern: string): void {
    this.client.keys(pattern, (err, datas) => {
      if (err) throw new Error(err.message);
      if (datas && datas.length > 0)
        this.client.del(datas, (err, data) => {
          if (err) throw new Error(err.message);
        });
    });
  }
}
// --------------------------- Middleware ----------------------------

interface SessionData {
  cookie: CookieOptions;
  user?: { id: string };
}

declare global {
  namespace Express {
    interface Request {
      sessionID: string;
      session: SessionData;
    }
  }
}

interface ISession {
  name?: string;
  secret: string;
  resave?: boolean;
  saveUninitialized?: boolean;
  cookie?: CookieOptions;
  genId?: (request: Request) => string;
  store: RedisStore;
}

function genIdDefault(req: Request) {
  const randomId = crypto.randomBytes(10).toString("hex");
  return randomId;
}

export const session =
  ({
    name = "session:",
    secret,
    resave,
    saveUninitialized,
    cookie,
    store,
    genId = genIdDefault,
  }: ISession): Middleware =>
  async (req, res, next) => {
    req.session = {
      cookie: { path: "/", httpOnly: true, secure: false, ...cookie },
    };

    const cookies = parse(req.get("cookie") || "");
    if (cookies[name]) {
      req.sessionID = decrypt(cookies[name], secret);
      const cookieRedis = await store.get(req.sessionID);
      if (cookieRedis) {
        req.session = JSON.parse(cookieRedis);
      }
    }

    const cookieProxy = new Proxy<CookieOptions>(req.session.cookie, {
      set(target, p: keyof CookieOptions, newValue, receiver) {
        if (p == "expires") {
          delete target["maxAge"];
        } else if (p == "maxAge") {
          delete target["expires"];
        }
        target[p] = newValue;
        req.sessionID = req.sessionID || `${store.prefix}${genId(req)}`;
        res.cookie(name, encrypt(req.sessionID, secret), target);
        store.set(
          req.sessionID,
          JSON.stringify(req.session),
          target["expires"]
            ? Math.abs(target["expires"].getTime() - Date.now())
            : target["maxAge"]
        );
        return true;
      },
    });

    req.session = new Proxy<SessionData>(
      {
        ...req.session,
        cookie: cookieProxy,
      },
      {
        set(target, p: keyof SessionData, newValue, receiver) {
          if (p == "cookie") {
            if ("expires" in newValue && "maxAge" in newValue) {
              const keysIndex = Object.keys(newValue);
              if (keysIndex.indexOf("maxAge") > keysIndex.indexOf("expires")) {
                delete newValue.expires;
              } else {
                delete newValue.maxAge;
              }
            }
            target.cookie = {
              ...target.cookie,
              ...newValue,
            };
          }
          if (p == "user") {
            target[p] = newValue;
          }
          req.sessionID = req.sessionID || `${store.prefix}${genId(req)}`;
          res.cookie(name, encrypt(req.sessionID, secret), {
            ...target.cookie,
          });
          store.set(
            req.sessionID,
            JSON.stringify(target),
            target.cookie.expires
              ? Math.abs(target.cookie.expires.getTime() - Date.now())
              : target.cookie.maxAge
          );
          return true;
        },
      }
    );

    next();
  };
