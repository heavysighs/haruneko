type Payload = {
    channel: string,
    parameters: JSONArray,
}

export namespace Channels {

    /**
     * Supported IPC Channels for managing the RPC service.
     */
    export enum RemoteProcedureCallManager {
        Stop = 'RemoteProcedureCallManager::Stop',
        Restart = 'RemoteProcedureCallManager::Restart',
    };

    /**
     * Supported IPC Channels for using the RPC service.
     */
    export enum RemoteProcedureCallContract {
        LoadMediaContainerFromURL = 'RemoteProcedureCallContract::LoadMediaContainerFromURL',
    };
}

type MessageCallback<TParameters extends JSONArray = JSONArray> = (...parameters: TParameters) => void | Promise<void>;
type RequestCallback<TParameters extends JSONArray = JSONArray, TReturn extends JSONElement | undefined = JSONElement | undefined> = (...parameters: TParameters) => TReturn | Promise<TReturn>;

export class IPC {

    private readonly messageHandlers = new Map<string, MessageCallback>;
    private readonly requestHandlers = new Map<string, RequestCallback>;

    constructor() {
        chrome.runtime.onMessage.addListener(this.OnMessage.bind(this));
    }

    private async OnMessage(message: Payload, _sender: chrome.runtime.MessageSender, sendResponse: (response?: JSONElement) => void): Promise<void> {
        try {
            if (this.messageHandlers.has(message.channel)) {
                const handle = <MessageCallback>this.messageHandlers.get(message.channel);
                await handle(...message.parameters);
            }
            if (this.requestHandlers.has(message.channel)) {
                const handle = <RequestCallback>this.requestHandlers.get(message.channel);
                sendResponse(await handle(...message.parameters));
            }
        } catch (error) {
            console.warn(error);
        }
    }

    public On<TParameters extends JSONArray>(channel: string, callback: MessageCallback<TParameters>): void {
        this.messageHandlers.set(channel, <MessageCallback>callback);
    }

    Send(channel: Channels.RemoteProcedureCallContract.LoadMediaContainerFromURL, url: string): void;
    public async Send<TParameters extends JSONArray>(channel: string, ...parameters: TParameters): Promise<void> {
        // NOTE: chrome.tabs.sendMessage must not be used here, it fatally crashes the
        // renderer in NW.js 0.79 (bad IPC message). chrome.runtime.sendMessage reaches
        // the same runtime.onMessage listeners in both directions.
        return new Promise<void>(resolve => chrome.runtime.sendMessage<Payload, void>({ channel, parameters }, () => resolve()));
    }

    Handle(channel: Channels.RemoteProcedureCallManager.Stop, callback: () => Promise<undefined>): void;
    Handle(channel: Channels.RemoteProcedureCallManager.Restart, callback: (port: number, secret: string) => Promise<undefined>): void;
    public Handle<TParameters extends JSONArray, TReturn extends JSONElement>(channel: string, callback: RequestCallback<TParameters, TReturn | undefined>): void {
        this.requestHandlers.set(channel, <RequestCallback>callback);
    }

    public async Invoke<TParameters extends JSONArray, TReturn extends JSONElement>(channel: string, ...parameters: TParameters): Promise<TReturn | undefined> {
        return new Promise<TReturn | undefined>(resolve => chrome.runtime.sendMessage<Payload, TReturn>({ channel, parameters }, resolve));
    }
}