import SocketControler from "wscc"
let _FileLoader;
const packetSize =  128 * 1024 
const voidFun = () => {}
const maxAllocated = 524288000;

/**
 * 
 * @param {[]} array  
 * @param {*} item 
 * @param {number} index  індекс undefined елемент видаляється, менше 0 вкінець
 * @param {Bollean} add якщо item небуде знайдений в array то він добавиться в кінець
 */
const swapPositionItem = (array, item, index, add = false) =>
{
    if(!Array.isArray(array))
        return;

    let index_ = array.indexOf(item);
    if(index_ === -1 && !add)
        return;

    if(index_ !== -1)
        array.splice(index_, 1);

    if(index === undefined && !add)
        return;
    else if(index < 0 || add)
        array.push(item);
    else
        array.splice(index, 0, item);
}

/**
* @param {*} groupList 
* @param {*} groupName 
* @param {Bollean} addGroup якщо група не знайдена то вона додасться
* @returns 
*/
 const findGroup = (groupList, groupName, addGroup = false) =>
 {
     for (let i = 0; i < groupList.length; i++) 
         if(groupList[i].id === groupName)
             return groupList[i];

     if(addGroup)        
     {
         groupList.push({id: groupName, fileList: []});
         return groupList[groupList.length - 1];
     }
     else
         return -1; // для swapPositionItem
 }

 const deleteFile = (groupList, loadFilePrivate) =>
 {                
     swapPositionItem(findGroup(groupList, loadFilePrivate.groupName).fileList, loadFilePrivate);                              
     let data = loadFilePrivate.data;
     loadFilePrivate.data = undefined;
     return data;            
 } 

 class Upload
 {
    #socket
    #groupList
    #currentUpload
    #uploadChanged 
    constructor(socket)
    {         
        this.#groupList = [{id: '', fileList: []}]  
        this.#currentUpload = undefined;
        this.#uploadChanged = false;
        this.#socket = socket;
    }   
            
    connect(sc)
    {
        sc.on("StartUploadResponse", (data) =>
        {                   
            if(!this.#currentUpload)
                return;

            if(data.status)
            {
                this.#currentUpload.amountData = data.amountData;

                if(!this.#currentUpload.id)
                    this.#currentUpload.start(data.response)

                this.#currentUpload.id = data.id;                                
                this.#upload(false, false, true)                
            }
            else
            {
                let err = this.#currentUpload.error;
                this.#currentUpload.valid = false;
                deleteFile(this.#groupList, this.#currentUpload);
                this.#currentUpload = undefined;
                err(1);;
                this.#upload();
            }
        });

        sc.on("UploadResponse", (data) =>
        {
            if(!this.#currentUpload || data.id !== this.#currentUpload.id)
                return;

            if(data.status)
            {
                if(!this.di)
                    this.di = 0

                if(data.amountData >= this.#currentUpload.data.size)
                    this.#socket.send("EndUpload", this.#currentUpload.id); 
                else 
                {
                    this.#currentUpload.amountData = data.amountData;
                    this.#currentUpload.status(this.#currentUpload.amountData, this.#currentUpload.data.size)
                    this.#upload(false, false, true)
                }
            }
            else
            {
                let err = this.#currentUpload.error;
                this.#currentUpload.valid = false;
                deleteFile(this.#groupList, this.#currentUpload);
                this.#currentUpload = undefined;
                err(4);
                this.#upload()
            } 
        });

        sc.on("EndUploadResponse", (data) =>
        {
            if(this.#currentUpload && this.#currentUpload.id === data.id)
            {
                var file = this.#currentUpload;
                this.#currentUpload = undefined;
            }
            else
            {
                for (let i = 0; i < this.#groupList.length; i++) 
                {
                    for (let j = 0; j < this.#groupList[i].fileList.length; j++) 
                    {
                        var file = this.#groupList[i].fileList[j];    
                        break
                    }
                }
            }

            file.valid = false;
            deleteFile(this.#groupList, file);
            if(data.status)
                file.end(data.response)
            else
                file.error(data.notallowed ? 2 : 4); 

            this.#upload(true)
        });
        
    }

    reconnecting()
    {
        this.#upload(false, true)
    }

    #abort(uploadFilePrivate)
    {
        if(!uploadFilePrivate.valid)
            return;

        uploadFilePrivate.valid = false;
        deleteFile(this.#groupList, uploadFilePrivate);        
        if(this.#currentUpload === uploadFilePrivate)
        {
            this.#currentUpload = undefined;
            this.#upload();
        }
    
        if(uploadFilePrivate.id)
            this.#socket.send("AbortDownload", uploadFilePrivate.id);    
    }

    #pause(uploadFilePrivate)
    {
        if(uploadFilePrivate.paused || !uploadFilePrivate.valid)
            return;

        uploadFilePrivate.paused = true;
        this.#upload();
    }

    #resume(uploadFilePrivate)
    {
        if(!uploadFilePrivate.paused || !uploadFilePrivate.valid)
            return;

        uploadFilePrivate.paused = false;
        swapPositionItem(findGroup(this.#groupList, uploadFilePrivate.groupName).fileList, uploadFilePrivate, -1)       
        if(!this.#currentUpload)
            this.#upload();
    }

    #changeGroup(uploadFilePrivate, groupName)
    {
        if(!uploadFilePrivate.valid)
            return;

        if(typeof(groupName) !== "number" && typeof(groupName) !== "string")
            return;

        swapPositionItem(findGroup(this.#groupList, uploadFilePrivate.groupName).fileList, uploadFilePrivate);
        uploadFilePrivate.groupName = groupName;
        swapPositionItem(findGroup(this.#groupList, uploadFilePrivate.groupName, true).fileList, uploadFilePrivate, -1, true);
        this.#upload(true);
    }

    #changePriority(uploadFilePrivate, newPriority)
    {
        if(uploadFilePrivate.paused || !uploadFilePrivate.valid || typeof(newPriority) !== "number")
            return;

        swapPositionItem(findGroup(this.#groupList, uploadFilePrivate.groupName).fileList, uploadFilePrivate, newPriority)
        return this.#upload(true);   
    }

    changePriorityGroupUpload(groupName, newPriority)
    {
        if(typeof(groupName) !== "number" && typeof(groupName) !== "string" && typeof(newPriority) !== "number")
            return;

        swapPositionItem(this.#groupList, findGroup(this.#groupList, groupName), newPriority);
    }
    
    getListUpload()
    {
        let groups = []
        for (let i = 0; i < this.#groupList.length; i++) 
        {
            let group = {groupName: this.#groupList[i].id, fileList: []}
            groups.push(group)
            for (let j = 0; j < this.#groupList[i].fileList.length; j++) 
                group.fileList.push(this.#groupList[i].fileList[j].public);
        }
        
        return groups;
    }
    
    #upload(check = false, reconnect = false, upload = false)
    {
        let findFile = () =>// самий преорітетний
        {
            for (let i = 0; i < this.#groupList.length; i++) 
                for (let j = 0; j < this.#groupList[i].fileList.length; j++) 
                    if(!this.#groupList[i].fileList[j].paused)
                        return this.#groupList[i].fileList[j];    
        }

        
        if(!this.#currentUpload || this.#currentUpload.paused || reconnect)
        {
            this.#currentUpload = findFile()
            if(!this.#currentUpload)
                return;

            return this.#socket.send("StartUpload", {header : this.#currentUpload.header, id : this.#currentUpload.id}) 
        }

        if(check)
        {
            if(findFile() === this.#currentUpload)
                return;
            else
                return this.#uploadChanged = true;
        }

        if(this.#uploadChanged)
        {
            this.#currentUpload = findFile();
            if(!this.#currentUpload)
                return;

            this.#uploadChanged = false;
            return this.#socket.send("StartUpload", {header : this.#currentUpload.header, id : this.#currentUpload.id, size: this.#currentUpload.data.size});
        }
        
        if(upload)
        {
            let amountData = this.#currentUpload.amountData;
            let currentUpload = this.#currentUpload;
            
            currentUpload.data.slice(amountData, amountData + packetSize)
                .arrayBuffer()
                .then((array) => this.#socket.send("Upload", array,  {amountData}))
                .catch((err) => 
                {
                    this.#abort(currentUpload)
                    currentUpload.error(3, err);
                })
        }   
    }

    upload(data, header, groupName = '', topPriority = false)
     {
        if(typeof(data) !== "object")
            return null;
        else if(typeof(groupName) !== "number" && typeof(groupName) !== "string")
            groupName = ''
      
        let abort = () => this.#abort(uploadFilePrivate);
        let pause = () => this.#pause(uploadFilePrivate);
        let resume = () => this.#resume(uploadFilePrivate);
        let changeGroup = (groupName_) => this.#changeGroup(uploadFilePrivate, groupName_)
        let changePriority = (newPriority) => this.#changePriority(uploadFilePrivate, newPriority)
        let uploadFilePrivate =
        {
            public: 
            {
                set start (fun) {if(typeof(fun) === "function") uploadFilePrivate.start = fun},
                set end  (fun) {if(typeof(fun) === "function") uploadFilePrivate.end = fun},
                set status (fun) {if(typeof(fun) === "function") uploadFilePrivate.status = fun},
                set error (fun) {if(typeof(fun) === "function") uploadFilePrivate.error = fun},
                get abort() {return abort},
                get pause() {return pause}, 
                get resume() {return resume},
                get changeGroup() {return changeGroup},
                get changePriority() {return changePriority},
                get header() {return header}
            },
            id : undefined, // дає сервер
            header,
            start: voidFun,
            end: voidFun,
            status: voidFun,
            error: voidFun,
            totalSize: undefined,
            amountData : 0,// кількість завантажених даних на сервер
            data: undefined, // Blob
            groupName,
            paused : false,
            valid : true // false якшо скасований чи закінчени
        }    

        if(data.constructor.name === "ArrayBuffer" || data.constructor.name === "File" || data.constructor.name === "Blob" || ArrayBuffer.isView(data))// так роблю щоб можна було з файловой системы завантажить дуже великий файл
        {
            uploadFilePrivate.data = new Blob([data]);
            uploadFilePrivate.totalSize = uploadFilePrivate.data.size;
        }
        else
            return null;

        let group = findGroup(this.#groupList, groupName, true);
        if(topPriority)
            group.fileList.unshift(uploadFilePrivate);
        else
            group.fileList.push(uploadFilePrivate); 
                      
        setTimeout(() => this.#upload(true), 0);
        return uploadFilePrivate.public;
     }
 }

 class Dowload
 {
    #socket
    #groupList
    #currentDownload
    #downloadChanged 
    constructor(socket)
    {         
        this.#groupList = [{id: '', fileList: []}]  
        this.#currentDownload = undefined;
        this.#downloadChanged = false;
        this.#socket = socket;
    }

    connect(sc)
    {             
        sc.on("StartDownloadResponse", (data) => 
        {// data.status  totalSize   response   notallowed    id(файла)               
            if(!this.#currentDownload || !this.#currentDownload.valid)// був скасований
                this.#currentDownload = undefined;
            else if(data.status)
            {
                try 
                {
                    this.#currentDownload.id = data.id;
                    if(this.#currentDownload.data.length === 0)
                    {
                        this.#currentDownload.totalSize = data.totalSize; 
                        let count = Math.floor(data.totalSize / maxAllocated)
                        for (let i = 0; i < count; i++) 
                            this.#currentDownload.data.push(new ArrayBuffer(maxAllocated));
    
                        count = data.totalSize - maxAllocated * count;
                        if(count > 0)
                            this.#currentDownload.data.push(new ArrayBuffer(count));
    
                        this.#currentDownload.start(data.response);                          
                    }

                    return this.#download(false,false,true);                
                } catch (error) 
                {
                    let err = this.#currentDownload.error;
                    deleteFile(this.#groupList, this.#currentDownload);
                    this.#currentDownload.valid = false;
                    this.#currentDownload = undefined;
                    console.error(error)
                    err(3)    
                }         
            }
            else
            { 
                let err = this.#currentDownload.error;
                deleteFile(this.#groupList, this.#currentDownload);
                this.#currentDownload.valid = false;
                this.#currentDownload = undefined;
                err(data.notallowed ? 1 : data.openError ? 2 : 4, data.response)    // openError                            
            }
            
            this.#download(); 
        });

        sc.on("DownloadResponse", (data, header) => 
        {            
            if(!this.#currentDownload || !this.#currentDownload.valid)
                this.#currentDownload = undefined;     
            else if(!header || this.#currentDownload.id !== header.id)       
                return this.#download();
            else if(data && data.constructor.name === "ArrayBuffer")
            {                 
                try 
                {         
                    let index = Math.floor(this.#currentDownload.amountData / maxAllocated)
                     let mainData = new DataView(this.#currentDownload.data[index], this.#currentDownload.amountData - index * maxAllocated);
                    data = new DataView(data);
                    let count = data.byteLength - data.byteLength % 8
                    for (let i = 0; i <  count; i += 8) 
                        mainData.setFloat64(i, data.getFloat64(i));

                    for (let i = count; i <  data.byteLength; i++) 
                        mainData.setInt8(i, data.getInt8(i));

                    this.#currentDownload.amountData += data.byteLength; 
                } catch (error) 
                {
                    let err = this.#currentDownload.error;
                    deleteFile(this.#groupList, this.#currentDownload);
                    this.#currentDownload.valid = false;
                    this.#currentDownload = undefined;
                    console.error(error);
                    err(4)
                }
                
                if(header.end)
                {                     
                    this.#currentDownload.valid = false;                        
                    let end = this.#currentDownload.end;
                    let downFilePrivate = this.#currentDownload
                    this.#currentDownload = undefined;                         
                    end(new Blob(deleteFile(this.#groupList, downFilePrivate)), header.response);                     
                }
                else
                {
                    this.#download(false,false,true);
                    return this.#currentDownload.status(this.#currentDownload.amountData, this.#currentDownload.totalSize);                        
                }
            }
            else 
            {
                let err = this.#currentDownload.error;
                deleteFile(this.#groupList,deleteFile(this.#groupList,this.#currentDownload));
                this.#currentDownload.valid = false;
                this.#currentDownload = undefined;
                err(4)
            }

            this.#download();
        });
        
        this.#download();
    }

    reconnecting()
    {
        this.#download(false, true);
    }   

    #abort(downFilePrivate)
    {
        if(!downFilePrivate.valid)
            return;

        downFilePrivate.valid = false;
        deleteFile(this.#groupList, downFilePrivate);        
        if(this.#currentDownload === downFilePrivate)
        {
            this.#currentDownload = undefined;
            this.#download();
        }

        if(downFilePrivate.id)
            this.#socket.send("AbortDownload", downFilePrivate.id);
    }
    
    #pause(downFilePrivate)
    {
        if(downFilePrivate.paused || !downFilePrivate.valid)
            return;

        downFilePrivate.paused = true;
        this.#download();
    }

    #resume(downFilePrivate)
    {
        if(!downFilePrivate.paused || !downFilePrivate.valid)
            return;

        downFilePrivate.paused = false;
        swapPositionItem(findGroup(this.#groupList, downFilePrivate.groupName).fileList, downFilePrivate, -1)       
        if(!this.#currentDownload)
            this.#download();
    }

    /**
     * 
     * @param {*} downFilePrivate 
     * @param {*} groupName якщо групи з таки іменем нема то створюється
     * @returns 
     */
    #changeGroup(downFilePrivate, groupName)
    {
        if(!downFilePrivate.valid)
            return;

        if(typeof(groupName) !== "number" && typeof(groupName) !== "string")
            return;

        swapPositionItem(findGroup(this.#groupList, downFilePrivate.groupName).fileList, downFilePrivate);
        downFilePrivate.groupName = groupName;
        swapPositionItem(findGroup(this.#groupList, downFilePrivate.groupName, true).fileList, downFilePrivate, -1, true);
        this.#download(true);
    }

    /**
     * 
     * @param {*} downFilePrivate 
     * @param {Number} newPriority 
     * @returns 
     */
    #changePriority(downFilePrivate, newPriority)
    {
        if(downFilePrivate.paused || !downFilePrivate.valid || typeof(newPriority) !== "number")
            return;

        swapPositionItem(findGroup(this.#groupList, downFilePrivate.groupName).fileList, downFilePrivate, newPriority)
        return this.#download(true);            
    }

    /**
     * 
     * @param {Number | String} groupName 
     * @param {Number} newPriority  менше ноля в кінець
     * @returns 
     */
    changePriorityGroupDownload(groupName, newPriority)
    {
        if(typeof(groupName) !== "number" && typeof(groupName) !== "string" && typeof(newPriority) !== "number")
            return;

        swapPositionItem(this.#groupList, findGroup(this.#groupList, groupName), newPriority);
    }
    
    getListDownload()
    {
        let groups = []
        for (let i = 0; i < this.#groupList.length; i++) 
        {
            let group = {groupName: this.#groupList[i].id, fileList: []}
            groups.push(group)
            for (let j = 0; j < this.#groupList[i].fileList.length; j++) 
                group.fileList.push(this.#groupList[i].fileList[j].public);
        }
        
        return groups;
    }

    #download(check = false, reconnect = false, download = false)
    {       
        let findFile = () =>// самий преорітетний
        {
            for (let i = 0; i < this.#groupList.length; i++) 
                for (let j = 0; j < this.#groupList[i].fileList.length; j++) 
                    if(!this.#groupList[i].fileList[j].paused)
                        return this.#groupList[i].fileList[j];    
        }

        if(!this.#currentDownload || this.#currentDownload.paused || reconnect)
        {
            this.#currentDownload = findFile()
            if(!this.#currentDownload)
                return;

            return this.#socket.send("StartDownload", {header : this.#currentDownload.header, id : this.#currentDownload.id})
        }

        if(check)// якшо додав новий чи зробив другий пріорітет файла чи групи
        {
            if(findFile() === this.#currentDownload)
                return;
            else
                return this.#downloadChanged = true;
        }

        if(this.#downloadChanged)
        {
            this.#currentDownload = findFile();
            if(!this.#currentDownload)
                return;

            this.#downloadChanged = false;
            return this.#socket.send("StartDownload", {header : this.#currentDownload.header, id : this.#currentDownload.id});
        }

        if(download)
            return this.#socket.send("Download", {amountData: this.#currentDownload.amountData, id: this.#currentDownload.id});

    }

    download(header, groupName = '', topPriority = false)
    { 
        if(typeof(groupName) !== "number" && typeof(groupName) !== "string")
            groupName = ''

        let abort = () => this.#abort(downFilePrivate);
        let pause = () => this.#pause(downFilePrivate);
        let resume = () => this.#resume(downFilePrivate);
        let changeGroup = (groupName_) => this.#changeGroup(downFilePrivate, groupName_)
        let changePriority = (newPriority) => this.#changePriority(downFilePrivate, newPriority)
        var downFilePrivate = 
        {     
            public : 
            {
                set start (fun) {if(typeof(fun) === "function") downFilePrivate.start = fun},
                set end  (fun) {if(typeof(fun) === "function") downFilePrivate.end = fun},
                set status (fun) {if(typeof(fun) === "function") downFilePrivate.status = fun},
                set error (fun) {if(typeof(fun) === "function") downFilePrivate.error = fun},
                get abort() {return abort},
                get pause() {return pause}, 
                get resume() {return resume},
                get changeGroup() {return changeGroup},
                get changePriority() {return changePriority},
                get header() {return header}// якщо header обєкт то допоки завантаження не почалось то можна змінювать поля і сервер получить змінений обєкт
            },
            id : undefined, // дає сервер
            header,
            start: voidFun,
            end: voidFun,
            status: voidFun,
            error: voidFun,
            totalSize: undefined,
            amountData : 0,// кількість завантажених даних 
            data: [],//[ArrayBuffer] 
            groupName,
            paused : false,
            valid : true // false якшо скасований чи закінчени
        }

        let group = findGroup(this.#groupList, groupName, true);
        if(topPriority)
            group.fileList.unshift(downFilePrivate)
        else
            group.fileList.push(downFilePrivate)
                
        setTimeout(() => this.#download(true), 0);
        return downFilePrivate.public;
    }
 }

class FileLoader // буде стаорено тіки раз
{    
    #Upload
    #Dowload
    #Socket
    constructor(url, port, secure)
    {
        if(_FileLoader)
            return _FileLoader;

        _FileLoader = this 
        this.#Socket = new SocketControler(url, port, secure)
        this.#Upload = new Upload(this.#Socket);
        this.#Dowload = new Dowload(this.#Socket);        
        this.#Socket.socketCreate = () => 
        {
            this.#Upload.connect(this.#Socket);
            this.#Dowload.connect(this.#Socket);            
        }
        this.#Socket.reconnecting = () => 
        {            
            this.#Upload.reconnecting();
            this.#Dowload.reconnecting();
        };
    }

    /**
     * 
     * @param {ArrayBuffer | TypedArray | DataView | Blob | File} data 
     * @param {*} header // якась інформація для авторизації
     * @param {Number | String} groupName 
     * @param {Bollean} topPriority 
     * @returns // якщо верне null то data невірна
     */
    upload(data, header, groupName, topPriority)
    {
        return this.#Upload.upload(data, header, groupName, topPriority);
    }

    /**
     * 
     * @param {*} header 
     * @param {Number | String} groupName 
     * @param {Boolean} topPriority 
     * @returns 
     */
    download(header, groupName, topPriority)
    {
        return this.#Dowload.download(header, groupName, topPriority)
    }

    /**
     * 
     * @param {String} groupname 
     * @param {Number} newPriority 
     */
    changePriorityGroupDownload(groupname, newPriority)
    {
        this.#Dowload.changePriorityGroupDownload(groupname, newPriority)
    }

    getListDownload()
    {
        return this.#Dowload.getListDownload()
    }

    getListUpload()
    {
        return this.#Upload.getListUpload()
    }

    changePriorityGroupUpload(groupName, newPriority)
    {
        this.#Upload.changePriorityGroupUpload(groupName, newPriority)
    }
}

export default FileLoader;