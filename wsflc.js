import SocketControler from "wscc"
let _FileLoader;
const  packetSize =  128 * 1024

 class Upload
 {
     constructor(sc)
     {         
        this._loaderUp = {}; // {id, key} 
        /// status 0 не стартує  0.5 запрос даний но не стартував 1 стартував  10 готовиться до скасування нуабо скасовується                       
        this._fileArray = [] 
        this._socket;
     }
        
    connect(sc)
    {
        sc.on("StartUploadResponse", (data) =>
        {            
            if(typeof(data.id) === "number")
                this._loaderUp.id = data.id;
            if(typeof(data.key) === "string")
                this._loaderUp.key = data.key;
            if(data.size >= 0)
                this._fileArray[0].size = data.size;

            if(data.status)
            {
                if(data.size === 0 && typeof(this._fileArray[0].funO.start) === "function")
                    this._fileArray[0].funO.start(data.response)

                this._fileArray[0].status = 1
                this._Upload();
            }
            else
            {
                let err = this._fileArray.shift().funO.error;
                if(typeof(err) === "function")
                    err(1, data.response);
            }
        });
        sc.on("UploadResponse", (data) =>
        {
            if(data.status)
            {
                this._fileArray[0].size += data.byteLength;
                if(typeof(this._fileArray[0].funO.status) === "function")
                    this._fileArray[0].funO.status(this._fileArray[0].size, this._fileArray[0].total)
                
                this._Upload();
            }
            else
            {
                let del = this._fileArray.shift();
                if(typeof(del.funO.error) === "function")
                    del.funO.error(4);

                this._Upload();
            } 
        });
        sc.on("EndUploadResponse", (data) =>
        {                   
            let del = this._fileArray.shift()
            if(data.status)
            {
                if(typeof(del.funO.end) === "function")
                    del.funO.end(data.response)    

                this._Upload();
            }
            else if(typeof(del.funO.error) === "function")
                del.funO.error(2, data.response);
        });
        sc.on("AbortUploadResponse", () =>
        {
            this._fileArray.shift()
            this._Upload();
        });
        this._Upload()
    }

    reconnecting()
    {
        if(this._fileArray.length > 0)
        {
            this._fileArray[0].status = 0;
            this._Upload()
        }
    }

    _Upload()
    {
        if(this._fileArray.length > 0 && this._socket.connected)
        {
            if(this._fileArray[0].status === 1)
            {
                if(this._fileArray[0].size < this._fileArray[0].total)
                {
                    let startOff = this._fileArray[0].total - (this._fileArray[0].size + packetSize) 
                    if(startOff > 0)
                        startOff = packetSize 
                    else
                        startOff = undefined
                        
                    this._socket.send("Upload", new DataView(this._fileArray[0].buffer, this._fileArray[0].size, startOff)) 
                }
                else
                    this._socket.send("EndUpload") 
            }
            else if(this._fileArray[0].status === 0)
            {
                this._fileArray[0].status = 0.5;
                this._socket.send("StartUpload",  {id: this._loaderUp.id, key: this._loaderUp.key , request : this._fileArray[0].header} ) 
            }
            else if(this._fileArray[0].status === 0.5)
                return;
            else
                this._socket.send("AbortUpload") 
        }
    }

    _abort(fileO)
    {
        let num = this._fileArray.indexOf(fileO)
        if(num < 0)
            return;
        else if(num === 0)
            this._fileArray[0].status = 10;
        else
            this._fileArray.splice(num,1)
    }
    
    upload(data, header)
     {
         let status = 0, abort;
         let sendFileO = 
         {
            funO : 
            {
                start: undefined,
                end : undefined,
                status : undefined,
                error : undefined,
                get abort() {return abort},
            },
            header : header,
            get status() {return status},
            set status(value) {status === 10? undefined :status = value }
         }
                 
         let add = (buffer) =>
         {
             sendFileO.buffer = buffer;
             sendFileO.total =  buffer.byteLength;
             sendFileO.size = 0;
             if(this._fileArray.push(sendFileO) === 1)
                this._Upload();
         }
 
        if(data.constructor.name === "File" || data.constructor.name === "Blob")
        {
            let reader = new FileReader();
            setTimeout(() => 
            {
                console.log("починається зчитування")
                reader.readAsArrayBuffer(data);
                reader.onload = (e)  =>
                {
                    reader = undefined;
                    add(e.target.result);
                };           
                
                reader.onerror = (e) =>
                {
                    if(typeof(sendFileO.funO.error) === "function")
                        sendFileO.funO.error(3, e.target.error);
                };                                
            }, 0);
            
            abort = () => 
            {
                if(reader)
                    reader.abort();
                else
                    this._abort(sendFileO);
            }
            return sendFileO.funO; 
        }
        else if(ArrayBuffer.isView(data))
            data = data.buffer;
        else if(data.constructor.name !== "ArrayBuffer")
            throw "ці дані не можуть бути відправельні. лише File | Blob | ArrayBuffer | DataView";
             
         add(data);
         abort = () => this._abort(sendFileO)
         return sendFileO.funO;
     }
 }

 class Dowload
 {
    constructor()
    {
        this._loaderDown = {}; // {id, key} 
        /// status 0 не стартує 0.5 надісланий но не стартувало 1 стартував 10 готовиться до скасування нуабо скасовується                       
        this._fileArray = [] 
        this._socket;
        this.fileArrayBufer; // DataView        
    }

    connect(sc)
    {                
        sc.on("StartDownloadResponse", (data) => 
        {
            if(data.status)
            {
                this.codeLoad  = data.codeLoad;
                if(data.id)
                    this._loaderDown.id = data.id
                
                if(data.key)
                    this._loaderDown.key = data.key

                if(data.size)
                    this._fileArray[0].total = data.size                   
                
                if(!this.fileArrayBufer)
                {
                    this.fileArrayBufer = new DataView(new ArrayBuffer(data.size))                    
                    if(typeof(this._fileArray[0].funO.start) === "function")
                        this._fileArray[0].funO.start(data.response);
                }

                this._fileArray[0].status = 1;
                this._download();
            }
            else
            {
                this.fileArrayBufer = undefined;
                let del = this._fileArray.shift();
                if(typeof(del.funO.error) === "function")
                    del.funO.error(data.notallowed ? 1 : 2, data.response);                
            }
        });

        sc.on("DownloadResponse", (data) => 
        {            
            if(!data)
                return;
            else if(data.constructor.name === "ArrayBuffer")
            {
                data = new DataView(data);
                try 
                {
                    for (let i = 0; i < data.byteLength ; i++)                     
                        this.fileArrayBufer.setUint8(this._fileArray[0].downloadSize + i, data.getUint8(i));
                }                
                catch (error) 
                {
                    console.error(error)
                    this.fileArrayBufer = undefined;
                    let del = this._fileArray.shift()
                    if(typeof(del.funO.error) === "function")
                        del.funO.error(2);
                }

                this._fileArray[0].downloadSize += data.byteLength;
                if(typeof(this._fileArray[0].funO.status) === "function")
                    this._fileArray[0].funO.status(this._fileArray[0].downloadSize, this._fileArray[0].total) 
            }
            else 
            {
                this.fileArrayBufer = undefined;
                let del = this._fileArray.shift();
                if(typeof(del.funO.error))
                    del.funO.error(2);
            }

            this._download();
        });

        sc.on("EndDownload", (response) => 
        {
            let del = this._fileArray.shift()
            if(typeof(del.funO.end) === "function")
                del.funO.end(this.fileArrayBufer.buffer, response);

            this.fileArrayBufer = undefined
            this._download()
        });

        sc.on("AbortDownloadResponse", () => 
        {            
            this.fileArrayBufer = undefined
            this._fileArray.shift();
            this._download();
        });
        this._download();
    }
    reconnecting()
    {
        if(this._fileArray.length > 0)
        {
            this._fileArray[0].status = 0;
            this._download()
        }
    }   

    _download()
    {
        if(this._fileArray.length > 0 && this._socket.connected)
        {
            if(this._fileArray[0].status === 1)
                this._socket.send("Download", {size: this._fileArray[0].downloadSize, codeLoad: this.codeLoad});
            else if(this._fileArray[0].status === 0)
            {
                this._fileArray[0].status = 0.5
                this._socket.send("StartDownload",  {id: this._loaderDown.id, key: this._loaderDown.key , request : this._fileArray[0].header} ) 
            }
            else if(this._fileArray[0].status === 0.5) 
                return;
            else if(this._fileArray[0].status === 10) 
            {
                this._socket.send("AbortDownload");
            }
        }
    }

    _abort(fileO)
    {        
        let num = this._fileArray.indexOf(fileO)
        if(num < 0)
            return;
        else if(num === 0 )
            this._fileArray[0].status = 10;
        else
            this._fileArray.splice(num,1)        
    }
    
    download(header)
    { 
        let status = 0
        let abort;
        let downFileO = 
        {     
            funO : 
            {
                start: undefined,
                end : undefined,
                status : undefined,
                error : undefined,
                get abort() {return abort},
            },
            downloadSize: 0,
            header : header,
            get status() {return status},
            set status(value) {status === 10? undefined :status = value }
        }

        if(this._fileArray.push(downFileO) === 1)
            this._download();

        abort = () => this._abort(downFileO);
        return downFileO.funO;
    }
 }

class FileLoader // буде стаорено тіки раз
{    
    constructor(url, port, secure)
    {
        if(_FileLoader)
            return _FileLoader;

        _FileLoader = this 
        this.Upload = new Upload();
        this.Dowload = new Dowload();
        this._socket = new SocketControler(url, port, secure)
        this._socket.socketCreate = () => 
        {
            this.Upload.connect(this._socket);
            this.Dowload.connect(this._socket);            
        }
        this._socket.reconnecting = () => 
        {            
            this.Upload.reconnecting();
            this.Dowload.reconnecting();
        };
        this.Upload._socket = this._socket; 
        this.Dowload._socket = this._socket;       
    }

    /**
     * якшо шось не понравить верта undefined
     * @param {File | Blob | ArrayBuffer | DataView } data функцію неможна
     * @param {!BinaryData} header // якась інформація для авторизації
     */
    upload(data, header)
    {
        return this.Upload.upload(data, header);
    }

    /**
     * @param {*} header 
     */
    download(header)
    {
        return this.Dowload.download(header)
    }
}

export default FileLoader;