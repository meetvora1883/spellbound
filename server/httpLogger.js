const chalk = require("chalk");

function timeIST(){
return new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
}

module.exports = function(req,res,next){

const start=Date.now();

res.on("finish",()=>{

const ms=Date.now()-start;

let color=chalk.green;

if(res.statusCode>=400) color=chalk.yellow;
if(res.statusCode>=500) color=chalk.red;

console.log(
chalk.gray(timeIST()),
chalk.blue("[HTTP]"),
chalk.magenta(req.method),
chalk.cyan(req.originalUrl),
"->",
color(res.statusCode),
chalk.green(ms+"ms")
);

});

next();

};