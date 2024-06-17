import {SocketApi} from "./server/websocket.js";

const ws = new SocketApi();


ws.login("enter","A505a");

ws.subscribeToLogs();