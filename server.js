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



//좋아요 기능구현
app.post('/wantit',verify,function(req,res){
	var id = req.body.id;
	var count = req.body.count;
	var realCount = parseInt(count);
	var username = req.code.username;
	var sql = 'select whoLike from review where id = ?;'
	conn.query(sql,id,function(err,rows,field){
		var array = rows[0].whoLike.split(",");
		console.log(array);
		// for(user in rows){
		// 	if(username === rows[0].whoLike.username){
		// 		var decreaseCount = realcount -1;
		// 		var realDecreaseCount = decreaseCount.toString();
		// 		var sql1 = "update review set count = ? where id = ?;"
		// 		conn.query(sql1,[realDecreaseCount,id],function(err,rows,field){
		// 			var sql1_1 = ``
		// 		})
		// 	}else{
		// 		var increaseCount = realcount +1;
		// 		var realIncreaseCount = increaseCount.toString();
		// 		var sql2 = "upate review set count = ? where id =? "
		// 		conn.query(sql2,[realIncreaseCount,id],function(err,rows,field){
		// 			var sql2_2 = `update review set whoLike = json_array_appen(whoLike,'$','{"username ":${username}})`
		// 			conn.query(sql2_2,function(err,rows,field){})
		// 		})
		// 	}
		// }
	})
	
})


//CREATE TABLE `review` (  
//	`id`  tinyint NOT NULL AUTO_INCREMENT, 
//	`title`  VARCHAR(100) NOT NULL ,  
//	`review`  VARCHAR(5000) NOT NULL ,   
//	`fileName`  VARCHAR(100) NOT NULL ,   
//	`location`  VARCHAR(250) NOT NULL , 
//	`author` varchar(100)
//	PRIMARY KEY (`id`)
//	);

// update user set review=concat(ifnull(review,""),?) where username=?;

//verify 미들웨어는 멀터 다음순서에 넣어야 미들웨어에서 바디값을 읽어올 수 있다. 
//현재라우터에선 미들웨어의 decode값을 req.code로 받아오고 있다.
//업로드시에 review 테이블에 author값을 넣고, user 테이블에 review데이타 디테일을 넣으려고한다.
app.post('/getReview',upload.array('reviewImage'),verify,function(req,res,next){
	console.log('uploaded '+req.files[0].fieldname+" files"+req.files[0].originalname);
	var location = req.files[0].location;
	var fileName = req.files[0].originalname;
	var title = req.body.title;
	var review = req.body.review;
	var username = req.code.username;
	var sql = 'insert into `review` (`title`,`review`,`fileName`,`location`,`author`,`whoLike`) values(?,?,?,?,?,?);'
	//var sql1 = `update user set review = JSON_ARRAY_APPEND(review,'$',?) where username=?;`
	var sql1 = 'update user set review=concat(ifnull(review,""),?) where username=?;'
	var params = [title,review,fileName,location,username,""]
	var reviewDetail= `{"title":${title},"review":${review},"location":${location}}`//여기까지 객체로 넣는거는 성공, 다만 어펜드하면서 주입시켜야 활용이 가능할거같다. 이부분을 연구해야할거같다. 참고 update user set review=concat(ifnull(review,""),"{again:again}");
	var param = [reviewDetail,username]
	conn.query(sql,params,function(err,rows,field){
			if(err) console.log("err!!!: " + err );
			console.dir("first query: "+rows.insertId);
			conn.query(sql1, [rows.insertId+",",username], function(err,rows,field){
			 	if(err) console.log("err!!!: " + err );
			 	console.log("success upload to database");
			 	res.send({session:"session"});
			 	})
			})	
});

app.post('/profileMain',verify,function(req,res){
	var username = req.code.username;
	var sql="select review from user where username=?"
	conn.query(sql,username,function(err,rows,field){
		if(err) console.log("first: "+err)
		var reviewsId = rows[0].review.split(",")
		reviewsId.pop();
		var sql1 = `select * from review where id in (${reviewsId})`;
		conn.query(sql1,function(err,rows,field){
			res.send({
				reviews:rows
			})
		})

	})
})

app.post('/getall',verify,function(req,res){
			var sql = 'select * from review';
			conn.query(sql,function(err,rows,fields){
				if(err)console.log('couldn\'t get data from review table : ' + err)
					console.log(req.code)
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
//				`review` varchar(250)
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



