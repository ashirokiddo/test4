import {CommandsEnums} from "../ts/enums/commands.enums.js";
import {WebSocket} from 'ws';
import {generateRandomStringBySize} from "../util/string.js";

export class SocketApi {
    private ws: WebSocket;
    private readonly baseUrl= "http://enter.local/";
    private readonly deferredTasks: Array<any> = [];
    private heartbeatCounter = 0;
    private token = "";
    private username = "";
    private callBackMap = new Map();

    constructor() {
        this.connect();
    }

    private connect() {
        this.ws = new WebSocket("ws://test.enter-systems.ru/");

        this.ws.onopen = (e) => {
            this.resolveDeferredTasks();
            this.pingServer();

            this.ws.onclose = (e) => {
                this.#handlerClose(e);
            };

            this.ws.onmessage = (e) => {
                this.#handlerMessage(JSON.parse(e.data));
            };
        }
    }

    // К сожалению плохо знаю ТС, но предполагаю, что вместо этого можно было бы
    // указатьразные вариации входных параметров по типу перегрузки, но так я буду делать еще дольше
    private sendCommand(command: CommandsEnums, ...args: Array<any>) {
        const task: Array<{command: CommandsEnums, url: string, args: Array<any>}> = [
            command,
            ...args,
        ];

        if (this.ws.readyState){
            this.ws.send(JSON.stringify(task))
        } else {
            this.deferredTasks.push(task);
        }
    }

    private resolveDeferredTasks() {
        if (this.deferredTasks.length) {
            this.deferredTasks.forEach( task => {
                this.ws.send(JSON.stringify(task))
            })
        }
    }

    login(login: string, password: string) {
        const callId = generateRandomStringBySize(16);

        this.sendCommand(
            CommandsEnums.Call,
            callId,
            `${this.baseUrl}login`,
            login,
            password
        );

        this.callBackMap.set(callId, this.handleLogin);
    }

    private handleLogin({Token,  Username}: {Token: string, Username: string}){
        this.token = Token;
        this.username = Username;
    }

    logout() {
        this.sendCommand(
            CommandsEnums.Call,
            `${this.baseUrl}logout`,
        );
    }

    loginByToken() {
        if (this.token) {
            this.sendCommand(
                CommandsEnums.Call,
                this.token,
                `${this.baseUrl}loginByToken?token=${this.token}`,
            );
        }
    }


    private subscribeTo(url) {
        this.sendCommand(
            CommandsEnums.Subscribe,
            `${this.baseUrl}subscription/${url}`,
        );
    }

    subscribeToLogs() {
        this.subscribeTo(`logs/list`)
    }

    private pingServer() {
        setInterval(() => {
            this.sendCommand(CommandsEnums.Heartbeat, this.heartbeatCounter);
            this.heartbeatCounter++;
        }, 30000)
    }

    #handlerClose(e) {
        console.log("error");
    }

    #handlerMessage(parsedResult) {
        console.log("parsedResult", parsedResult);

        switch (parsedResult[0]) {
            case CommandsEnums.Welcome: {
                console.log("Welcome", parsedResult);
                break
            }
            case CommandsEnums.CallResult: {
                console.log("result: ", parsedResult[2]);
                if (this.callBackMap.has(parsedResult[1])) {
                    this.callBackMap.get(parsedResult[1]).call(this, parsedResult[2]);
                    this.callBackMap.delete(parsedResult[1]);
                }
                break
            }
            case CommandsEnums.CallError: {
                if (this.callBackMap.get(parsedResult[1])) {
                    this.callBackMap.delete(parsedResult[1]);
                }
                console.warn("Метод, который вернул ошибку: ", parsedResult[2])
                console.warn("Сообщение об ошибке (строка)", parsedResult[3])
                if (parsedResult[4]) {
                    console.warn("error details: ", parsedResult[4])
                }
                break
            }
            case CommandsEnums.Event: {
                console.log("Произошло событие: ", parsedResult[2]);
                break
            }
            case CommandsEnums.Heartbeat: {
                console.log("Heart beat is working fine ", this.heartbeatCounter);
                break
            }
        }
    }

    #handlerError(error) {
        console.log(error, "type of error")
    }
}