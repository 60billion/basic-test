var express = require('express');
var bodyparser = require('body-parser');
var logger = require('morgan');
var methodOverride = require('method-override');
var cors = require('cors');
var pbkfd2Password = require('pbkdf2-password');
var hasher = pbkfd2Password();
var jwk = require('jsonwebtoken');
//서버구동
var app = express();
app.use(logger('dev'));
app.use(bodyparser.json());
app.use(methodOverride());
app.use(cors());

//데이터베이스 접속
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


//CREATE TABLE `review` (  
//	`id`  tinyint NOT NULL AUTO_INCREMENT, 
//	`title`  VARCHAR(100) NOT NULL ,  
//	`review`  VARCHAR(5000) NOT NULL ,   
//	`fileName`  VARCHAR(100) NOT NULL ,   
//	`location`  VARCHAR(250) NOT NULL , 
//	PRIMARY KEY (`id`)
//	);

app.post('/getReview',upload.array('reviewImage'),function(req,res,next){
	console.log('uploaded '+req.files[0].fieldname+" files"+req.files[0].originalname);
	var location = req.files[0].location;
	var fileName = req.files[0].originalname;
	var title = req.body.title;
	var review = req.body.review;
	var sql = 'insert into `review` (`title`,`review`,`fileName`,`location`) values(?,?,?,?);'
	var params = [title,review,fileName,location]
	conn.query(sql,params,function(err,rows,field){
			if(err) console.log("err!!!: " + err );
			console.log("success upload to database");
			res.send({session:"session"});
			})	
});

app.post('/getall',verify,function(req,res){
			var sql = 'select * from review';
			conn.query(sql,function(err,rows,fields){
				if(err)console.log('couldn\'t get data from review table : ' + err)
					res.send({
						reviews:rows
					})		
				})
		})

//REATE TABLE `user` (
//			    `id`  tinyint NOT NULL  AUTO_INCREMENT,
//				`username`  varchar(50) NOT NULL ,
//				`password`  varchar(500) NOT NULL ,
//				`key`  varchar(500) NOT NULL ,
//				`profileimg`  varchar(250) NOT NULL,
//				PRIMARY KEY (`id`)
//				);
app.post('/register',function(req,res){
			var username = req.body.username;
			var password = req.body.password;
			var sql = "select username from user;"
			var checkDuplicate = "";
			conn.query(sql,function(err,rows,fields){
				for(email in rows){
					if(username === rows[email].username){
						checkDuplicate = "true";
					}
				}
				if(checkDuplicate){
					res.send({result:"duplicated"});
				}else{
					hasher({password:password},function(err,pass,salt,hash){
							var sql2 = 'insert into user (`username`,`password`,`key`) values(?,?,?);';
							var params = [username,hash,salt];
							conn.query(sql2,params,function(err,rows,fields){
									console.log("success to register")
									res.send({result:"registered"});
							})
					})
				}
			})
		})

app.post('/login',function(req,res){
	var username = req.body.username;
	var password = req.body.password;
	var sql = 'select * from user';
	var checkUsername = "";
	conn.query(sql,function(err,rows,fields){
		for(num in rows){
			if(username === rows[num].username){
				checkUsername = "true";
				var sql1 = "select * from user where id=?"
				var param = rows[num].id;
				conn.query(sql1,param,function(err,row,fields){
					hasher({password:password, salt:row[0].key},function(err,pass,salt,hash){
						if(row[0].password === hash){
							var params = {
								username:username,
								password:password
							}
							jwk.sign(params,"secretkey",function(err,token){
								res.send({
									token:token,
									result:"success"
								})			
							})
						}else{
							res.send({result:"passwordErr"});
						}
					})
				})
			}
		}
		if(!checkUsername){
			res.send({result:"usernameErr"});
		}
	})

})

function verify (req,res,next){
	const token = req.body.tokens;
	console.log(token+"!!!!");
	if(!token){
		return res.send({
					login:"login"
				});
	}else{
		jwk.verify(token,'secretkey',(err,code) =>{
			if(err){
			 console.log(err)	
			}else{	
			req.code = code
			next()
			}
		})
	}

}


app.listen(9000, function(){
    console.log("connected server!!")
})



