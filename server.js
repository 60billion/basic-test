var express = require('express');
var bodyparser = require('body-parser');
var logger = require('morgan');
var methodOverride = require('method-override');
var cors = require('cors');
//서버구동
var app = express();
app.use(logger('dev'));
app.use(bodyparser.json());
app.use(methodOverride());
app.use(cors());

//데이터베이스 접속
var mysql = require('mysql');
var conn = mysql.createConnection({
    user:"root",
    password:"11131113",
    port:3306,
    database:"public"
})
conn.connect(function(){
    console.log("connected database!!")
});

//아마존 접속
var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';
var s3 = new AWS.S3();

//멀터정리
var multer = require('multer');
var multerS3 = require('multer-s3');
var upload = multer({
    storage:multerS3({
        s3:s3,
        bucket:'allrvw',
        acl:'public-read',//이미지링크를 외부에서 볼 수 있도록하기위해서 버킷이 퍼블릭이 아닐떄도 되는지는 확인해봐야 할거같다.
        metadata:function(req,file,cb){
            cb(null,{fieldName:file.fieldname})
        },
        key:function(req,file,cb){
            cb(null,file.originalname+".jpeg")
        },
        contentType:function(req,file,cb){
            cb(null,'image/jpeg')
        }
    })
});



//Gets or Posts
app.get('/',function(req,res){
	res.send("hello world");
})

app.post('/getReview',upload.array('reviewImage'),function(req,res,next){
    console.log('uploaded '+req.files[0].fieldname+" files"+req.files[0].originalname);
    console.dir(req.files);
	var link = req.files[0].location;
	var fileName = req.files[0].originalname;
	var title = req.body.title;
	var review = req.body.review;
	console.log(link);
	console.log("fileName:  "+fileName);
	console.log("title:  " +title);
	console.log("review:  " + review);
	
})


app.listen(9000, function(){
    console.log("connected server!!")
})



