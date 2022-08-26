npm install wsflc <br>
для сервера <a href="https://www.npmjs.com/package/wsfls">тут</a>
```
import FileLoader from "wsflc";
const fl = new FileLoader("localhost", 3210, true)// true === ssl

/*download*/
        import FileLoader from "wsflc";
        const fl = new FileLoader("localhost", 3210, true) // 192.168.0.100
        let download = fl.download({id: 78146, key : "go hall", fileName : "!!!!!!!.jpg", number : 1}) 
        let download2 = fl.download({id: 78146, key : "go hall", fileName : "jahi_7826872aiYRx_82.jpg", number : 2}, "qwe") 
        let download3 = fl.download({id: 78146, key : "go hall", fileName : "5732843_5.png", number : 3}, 1) 
        let download4 = fl.download({id: 78146, key : "go hall", fileName : "iou.jpg", number : 4}, 2) 
        let download5 = fl.download({id: 78146, key : "go hall", fileName : "578ws_y6.jpg", number : 5}, 1, true) 
        let download6 = fl.download({id: 78146, key : "go hall", fileName : "archlinux.jpg", number : 6}, "nameGroup")  
        let download7 = fl.download({id: 78146, key : "go hall", fileName : "killW.jpg", number : 7}, "nameGroup") 

        download.start = (response) =>
        {
            console.log(response);
        }

        download.end = (blob, response) =>
        {              
            console.log("end", blob, 1);            
            document.getElementsByTagName("img")[0].src = URL.createObjectURL(blob)            
        }        
        
        download.status = (loaded, total) =>
        {
           console.log(loaded, total);             
        }        

        download.error = (typeError, response) =>
        {
            switch (typeError) 
            {
                case 1:// завантаження заборонене 
                    console.error(typeError, response)
                    break; // 
                case 2: //  openError        
                case 3: // проблеми з виділенням памяті             
                case 4: // невідома помилка
                    console.error(typeError)
                    break;
            }
        }

        document.getElementById("abort").addEventListener("click", () =>
        {
            download.abort();
        });

        document.getElementById("pause").addEventListener("click", () =>
        {
            download.pause();
        });
        
        document.getElementById("resume").addEventListener("click", () =>
        {
            download.resume();
        });
        
        console.log(fl.getListDownload())
        /*[
            {
                "groupName": "",
                "fileList": [download]
            },
            {
                "groupName": "qwe",
                "fileList": [download2]
            },
            {
                "groupName": 1,
                "fileList": [download5,download3]
            },
            {
                "groupName": 2,
                "fileList": [download4]
            },
            {
                "groupName": "nameGroup",
                "fileList": [download6,download7]
            }
        ]*/        

        fl.changePriorityGroupDownload("qwe", -1)// якщо значення менше нуля то група получа найнижчий приорітет
        fl.changePriorityGroupDownload(2, 0)
        console.log(fl.getListDownload())
/*[
            {
                "groupName": 2,
                "fileList": [download4]
            },
            {
                "groupName": "",
                "fileList": [download]
            },
            {
                "groupName": 1,
                "fileList": [download5,download3]
            },
            {
                "groupName": "nameGroup",
                "fileList": [download6,download7]
            },
            {
                "groupName": "qwe",
                "fileList": [download2]
            }
        ]*/        

        download3.changePriority(0);
        download6.changePriority(-1);// якщо файл на паузі то пріорітет не зміниться
        console.log(fl.getListDownload())
/*[
            {
                "groupName": 2,
                "fileList": [download4]
            },
            {
                "groupName": "",
                "fileList": [download]
            },
            {
                "groupName": 1,
                "fileList": [download3,download5] 
            },
            {
                "groupName": "nameGroup",
                "fileList": [download7, download6]
            },
            {
                "groupName": "qwe",
                "fileList": [download2]
            }
        ]*/

        download3.changeGroup('qwe');
        console.log( fl.getListDownload()[3].fileList[0].header.fileName)
/*[
            {
                "groupName": 2,
                "fileList": [download4]
            },
            {
                "groupName": "",
                "fileList": [download]
            },
            {
                "groupName": 1,
                "fileList": [download5] 
            },
            {
                "groupName": "nameGroup",
                "fileList": [download7, download6]
            },
            {
                "groupName": "qwe",
                "fileList": [download2, download3]
            }
        ]*/

/* upload */
        const fl = new FileLoader("192.168.0.100", 3210, true)// true === ssl
        const upload = fl.upload(e.target.files[0], {id: 78146, key : "go hall", fileName : e.target.files[0].name})
        
        
        upload.start = (response) =>
        {
            console.log(response);
        }

        upload.end = (response) =>
        {
            console.log(response);
        }

        let per = 0
        upload.status = (loaded, total) =>
        {          
           // console.log(loaded, total);                  
        }        

        upload.error = (typeError, response) =>
        {
            console.log(typeError, response)
            switch (typeError) 
            {
                case 1:// сервер відмовився завантажувати файл
                case 2:// сервер завантажив файл но відмовився зберігати            
                    console.error(typeError, response)
                        break;
                case 3:// проблеми з читанням файла
                    console.error(typeError, response) // response містить в собі помилку
                    break;
                case 4: // typeError = 4 невідома помилка   
                    console.error(typeError)
                break
                default:
                    break;
            }
        }

        // все те саме що і в Download
        fl.getListUpload // аналог getListDownload
        fl.changePriorityGroupUpload // аналог changePriorityGroupDownload