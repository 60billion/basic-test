var express = require('express');
var bodyparser = require('body-parser');
var logger = require('morgan');
var methodOverride = require('method-override');
var cors = require('cors');

var mysql = require('mysql');

var conn = mysql.createConnection({
    host:"testdatabase.c3asktw2nxxm.ap-northeast-2.rds.amazonaws.com",
    user:"root",
    password:"11131113",
    database:"public"
})
conn.connect(function(){
    console.log("connected database!!")
});

var app = express();
app.use(logger('dev'));
app.use(bodyparser.json());
app.use(methodOverride());
app.use(cors());

app.listen(process.env.PORT || 8080, function(){
    console.log("connected server!!")
})



