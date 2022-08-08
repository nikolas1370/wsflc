npm install wsflc <br>
для браузера <a href="https://github.com/nikolas1370/wsfls">тут</a>
```
import FileLoader from "wsflc";
const fl = new FileLoader("localhost", 3210, true)// true === ssl

const send = fl.upload(e.target.files[0], {id: 78146, key : "go hall", fileName : e.target.files[0].name})
send.start = (response) =>
{
    console.log(response);
}

send.end = (response) =>
{
    console.log(response);
}

send.status = (loaded, total) =>
{            
    console.log(loaded, total);            
}        

send.error = (typeError, response) =>
{
    console.log(typeError, response)
    switch (typeError) 
    {
        case 1:// сервер відмовився завантажувати файл
        case 2:// сервер завантажив файл но відмовився зберігати            
        case 3:// проблеми з читанням файла
            console.error(typeError, response)
            break;
        case 4: // typeError = 4 невідома помилка   
            console.error(typeError)
            break
    }
}

document.getElementsByTagName("button")[0].addEventListener("click", () =>
{
    send.abort();// відміня загрузку на сервер
});

/*download*/

let download = fl.download({id: 78146, key : "go hall", fileName : "jahi_7826872aiYRx_82.jpg"}) 
download.start = (response) =>
{
    console.log(response);
}

download.end = (arrayBuffer, response) =>
{            
    console.log(arrayBuffer, response);            
    document.getElementsByTagName("img")[0].src = URL.createObjectURL(new Blob([arrayBuffer]))
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
            console.log(typeError, response)
            break;
        case 2: //  невідома помилка  
            console.log(typeError)
            break;
    }
}
document.getElementsByTagName("button")[0].addEventListener("click", () =>
{
    download.abort();// відміня загрузку на сервер
});     
