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

// CREATE TABLE `comment` (
// 	`reviewId` INT NOT NULL,
// 	`nickname` VARCHAR(50) NOT NULL,
// 	`profileimg` VARCHAR(300) NOT NULL,
// 	`comment` VARCHAR(500) NOT NULL,
// 	`underComment` INT NOT NULL AUTO_INCREMENT
// 	PRIMARY KEY(`underComment`)
// 	);

// CREATE TABLE `underComment` (
//  `reviewId` INT NOT NULL,
// 	`underComment` INT NOT NULL,
// 	`nickname` VARCHAR(50) NOT NULL,
// 	`profileimg` VARCHAR(300) NOT NULL,
// 	`comment` VARCHAR(500) NOT NULL,
// 	);

function compare(a,b){
	var f = parseInt(a.count)
	var s = parseInt(b.count)
	if(f<s){
		return 1;
	}else if(f>s){
		return -1;
	}
	return 0;
}

//인기 리뷰 보내기
app.post('/gethots',verify,function(req,res){
	var sql = 'select id,count from review;';
	conn.query(sql,function(err,rows,fields){
		rows.sort(compare);
		var array = [];
		for(var i=0; i<3; i++){
			console.log("11 : "+ JSON.stringify(rows[i]))
			array.push(rows[i]);
		}
		console.log("getHotttest: "+JSON.stringify(array));
	})
})

//경험클릭화면
app.post('/intopage',verify,function(req,res){
	var id = req.body.id;
	var sql = "select * from review where id = ? ;"
	conn.query(sql,id,function(err,rows,fields){
		res.send({result:rows});
	})
})


//댓글삭제하기
app.post('/deletecomment',verify, function(req,res){
	var username = req.code.username;
	console.log(username);
	var username1 = req.body.username;
	console.log(username1)
	var underComment = req.body.underComment;
	console.log(underComment);
	if(username == username1){
		console.log("matching")
		var sql = `update comment set profileimg = ?, nickname= ?, comment =?, del = ? where underComment = ? ;`
		var profileimg = "https://s3.ap-northeast-2.amazonaws.com/allrvw/defautl_img/profile_gray_img.png";
		var nickname = "이름없음"
		var comment = "삭제된 댓글입니다."
		var del = "0"
		var params = [profileimg,nickname,comment,del,underComment];
		conn.query(sql,params,function(err,rows,fields){
			console.log("deleted comment updated!");
			res.send({result:"success"});
		})
	}else{
		console.log("noMatching");
		res.send({noOwner:"noOwner"})
	}

})

//하위댓글삭제하기
app.post('/deleteundercomment',verify, function(req,res){
	var username = req.code.username;
	var username1 = req.body.username;
	var id = req.body.id;
	if(username == username1){
		var sql = `update underComment set profileimg = ? , nickname = ? , comment = ?, del = ?  where id = ? ;`
		var profileimg = "https://s3.ap-northeast-2.amazonaws.com/allrvw/defautl_img/profile_gray_img.png";
		var nickname = "이름없음"
		var comment = "삭제된 댓글입니다."
		var del = "0"
		var params = [profileimg,nickname,comment,del,id];
		conn.query(sql,params,function(err,rows,fields){
			console.log("deleted underComment updated!");
			res.send({result:"success"});
		})
	}else{
		res.send({noOwner:"noOwner"})
	}
})

//댓글정보받아오기
app.post('/getcomments',function(req,res){
	var reviewId = req.body.reviewId;
	var sql = "select * from comment where reviewId = ?;";
	conn.query(sql,reviewId,function(err,rowsTop,fields){
		if(rowsTop[0] == null){
			res.send({noComments:"noComments"})
			//여기부터는 댓글카운터 업데이트하는 내용
			var sql2 = `select reviewId from comment where reviewId = ${reviewId} and  del =1;`
			var sql3 = `select reviewId from underComment where reviewId = ${reviewId} and del =1;`
			var sql4 = `update review set cocount = ? where id = ?`
			conn.query(sql2,function(err,rows,fields){
				var count1 = rows.length;
				conn.query(sql3,function(err,rows,fields){
					var count2 = rows.length;
					var total = count1 + count2;
					var realtotal = String(total)
					conn.query(sql4,[realtotal,reviewId],function(err,rows,fields){

					})
				})
			})
			return;
		}
		var sql1 = "select * from underComment where reviewId =?";
		conn.query(sql1, reviewId, function(err,rowsUnder,fields){
			var comments = {
				topComments:rowsTop,
				underComments:rowsUnder
			}
			res.send({result:comments})
			//여기부터는 댓글카운터 업데이트하는 내용
			var sql2 = `select reviewId from comment where reviewId = ${reviewId} and del =1;`
			var sql3 = `select reviewId from underComment where reviewId = ${reviewId} and del =1;`
			var sql4 = `update review set cocount = ? where id = ?`
			conn.query(sql2,function(err,rows,fields){
				var count1 = rows.length;
				conn.query(sql3,function(err,rows,fields){
					var count2 = rows.length;
					var total = count1 + count2;
					var realtotal = String(total)
					conn.query(sql4,[realtotal,reviewId],function(err,rows,fields){

					})
				})
			})
		})
	})
})

//댓글받아서 데이터베이스에 올리는 기능
app.post('/comment',verify,function(req,res){
	var comment = req.body.comment;
	var username = req.code.username;
	var reviewId = req.body.reviewId;
	var sql = 'select nickname,profileimg from user where username = ?'
	conn.query(sql,username,function(err,rows,fields){
		var nickname = rows[0].nickname;
		var profileimg = rows[0].profileimg;
		var sql1 = 'insert into `comment`(`reviewId`,`nickname`,`profileimg`,`comment`,`username`) values(?,?,?,?,?);'
		var params = [reviewId, nickname, profileimg, comment, username];
		conn.query(sql1,params,function(err,rows,fields){
			res.send({result:"comment"});
			console.log("comment uploaded successfully!!");
			//여기부터는 댓글카운터 업데이트하는 내용
			var sql2 = `select reviewId from comment where reviewId = ${reviewId} and del =1;`
			var sql3 = `select reviewId from underComment where reviewId = ${reviewId} and del =1;`
			var sql4 = `update review set cocount = ? where id = ?`
			conn.query(sql2,function(err,rows,fields){
				var count1 = rows.length;
				conn.query(sql3,function(err,rows,fields){
					var count2 = rows.length;
					var total = count1 + count2;
					var realtotal = String(total)
					conn.query(sql4,[realtotal,reviewId],function(err,rows,fields){

					})
				})
			})
		})
	})
})
//undercomment 댓글받아서 데이터베이스에 올리는 기능
app.post('/undercomment',verify,function(req,res){
	var username = req.code.username;
	var reviewId = req.body.reviewId;
	var underComment = req.body.underComment;
	var comment = req.body.comment;
	var sql = "select nickname,profileimg from user where username = ?; "
	conn.query(sql,username,function(err,rows,fields){
		var nickname = rows[0].nickname;
		var profileimg = rows[0].profileimg;
		var sql1 = "insert into `underComment`(`reviewId`,`underComment`,`nickname`,`profileimg`,`comment`,`username`) values(?,?,?,?,?,?);";
		var params = [reviewId,underComment,nickname,profileimg,comment,username];
		conn.query(sql1,params,function(err,rows,fields){
			res.send({result:"comment"});
			console.log("underComment uploaded successfully!!"+rows)
			//여기부터는 댓글카운터 업데이트하는 내용
			var sql2 = `select reviewId from comment where reviewId = ${reviewId} and del =1;`
			var sql3 = `select reviewId from underComment where reviewId = ${reviewId} and del =1;`
			var sql4 = `update review set cocount = ? where id = ?`
			conn.query(sql2,function(err,rows,fields){
				var count1 = rows.length;
				conn.query(sql3,function(err,rows,fields){
					var count2 = rows.length;
					var total = count1 + count2;
					var realtotal = String(total)
					conn.query(sql4,[realtotal,reviewId],function(err,rows,fields){

					})
				})
			})
		})
	})
})




//좋아요 기능구현
//좋아요를 누르면 좋아요를 누른 리뷰 아이디와 리뷰의 카운트를 가지고온다. 
//가지고온 아이디로 테이블을 조회하고 테이블에 whoLike에 사용자아이디가있는지 검사한다.
//검사 후 아이디가없으면 가지고 온 카운트값에 1을 더해서 업데이트해준다. 이어서 review 테이블에 whoLike 칼럼에 사용자 아이디를 추가한다. -- 앞으로: user테이블에 review ID를 추가한다.
//검사 후 아이디가 있으면 가지고 온 카운트값에 1을 뺴서 업데이트해준다. 이어서 review 테이블에 whoLike 칼럼에 사용자 아이디를 제거한다. -- 앞으로: user테이블에 review ID를 제거한다.

app.post('/wantit',verify,function(req,res){
	var id = req.body.id;
	var count = req.body.count;
	var realCount = parseInt(count);
	var username = req.code.username;
	var sql = 'select whoLike from review where id = ?;'
	conn.query(sql,id,function(err,rows,field){
		if(rows[0]==null){
			var array = rows[0].whoLike;
		}
		var array = rows[0].whoLike.split(",");//콤마가 계속 쌓이는걸 막는 방법을 찾아야한다.=>해결함 아래 확인
		for(i in array){
			if(username === array[i]){
				var decreaseCount = realCount -1;
				var realDecreaseCount = decreaseCount.toString();
				var sql1 = "update review set count = ? where id = ?;"
				array.splice(i,1);
				conn.query(sql1,[realDecreaseCount,id],function(err,rows,field){
					console.log("compeleted count decrease : " +rows)
					var stringfy = ""
					for(a in array){
						if(array[a]!="")//콤마가 계속 쌓이는걸 막는 방법
						stringfy = stringfy+array[a]+",";
					}
					var sql1_1 = 'update review set whoLike=? where id=?;'
					var params = [stringfy,id];
					conn.query(sql1_1,params,function(err,rows,field){
						console.log("compeleted decresase : " +rows)
						res.send({result:"decrease"})
						sql1_2 = "select likeReview from user where username = ?"
						conn.query(sql1_2,username,function(err,rows,field){
							var realId = String(id);
							if(rows[0]==null){
								var userArray = rows[0].likeRview;
							}
							var userArray = rows[0].likeReview.split(",");
							
							var stringfy1 = ""
							for(b in userArray){
								if(userArray[b] != realId && userArray[b] != ""){
									stringfy1 = stringfy1 + userArray[b]+",";
								}
							}
							sql1_3 = "update user set likeReview = ? where username = ?";
							var params = [stringfy1, username]
							conn.query(sql1_3,params,function(err,rows,field){
								console.log("uploaded likeReview numbers(decrease) : "+rows)
							})

						})
					});
				});
				return;
			}
		}
		var increaseCount = realCount + 1;
		var realIncreaseCount = increaseCount.toString();
		var sql2 = "update review set count = ? where id = ?;"
		conn.query(sql2,[realIncreaseCount,id],function(err,rows,field){
			console.log("compeleted count increase : " +rows)
			var sql2_1 = 'update review set whoLike=concat(ifnull(whoLike,""),?) where id=?;'
			var params = [username+",",id];
			conn.query(sql2_1,params,function(err,rows,field){
				console.log("compeleted username increase : " +rows)
				res.send({result:"increase"})
				var sql2_2 = 'update user set likeReview=concat(ifnull(likeReview,""),?) where username=?;'
				var params = [id+",",username];
				conn.query(sql2_2,params,function(err,rows,field){
					console.log("uploaded review id to user table: " +rows);
				})
			})
		})


	})
	
})

app.post('/showLikes',verify,function(req,res){
	var sql = 'select likeReview from user where username = ?'
	var username = req.code.username;
	console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!")
	conn.query(sql,username,function(err,rows,field){
		console.log("showLikes Check console : " + rows[0].likeReview);
		if(rows[0].likeReview == null){
			res.send("noData")
			return;
		}
			var idList = rows[0].likeReview.split(",")
			idList.pop();
			console.log(idList)
		
		
		var sql1 = `select * from review where id in (${idList})`;
		conn.query(sql1,function(err,rows,field){
			var even = [];
			var odd = [];
			for(i in rows){
				if(i%2==0){
					even.push(rows[i])
				}else{
					odd.push(rows[i])
				}
			}
			var likeList = {
				even:even,
				odd:odd
			}
			console.log(likeList.even);
			console.log(likeList.odd);
			res.send({
				result:likeList
			})
		}) 
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
	var category = req.body.category;
	var productName = req.body.productName;
	var productInfo = req.body.productInfo;
	var username = req.code.username;
	var sql0 = "select nickname,profileimg from user where username = ?;"
	conn.query(sql0,username,function(err,rows,fields){
		var nickname = rows[0].nickname;
		var profileimg = rows[0].profileimg
		var sql = 'insert into `review` (`title`,`review`,`fileName`,`location`,`author`,`whoLike`,`category`,`productName`,`productInfo`,`nickname`,`profileimg`) values(?,?,?,?,?,?,?,?,?,?,?);'
		//var sql1 = `update user set review = JSON_ARRAY_APPEND(review,'$',?) where username=?;`
		var sql1 = 'update user set review=concat(ifnull(review,""),?) where username=?;'
		var params = [title,review,fileName,location,username,"",category,productName,productInfo,nickname,profileimg]
		
		conn.query(sql,params,function(err,rows,field){
				if(err) console.log("err!!!: " + err );
				console.dir("first query: "+rows.insertId);
				conn.query(sql1, [rows.insertId+",",username], function(err,rows,field){
					if(err) console.log("err!!!: " + err );
					console.log("success upload to database");
					res.send({session:"session"});
					})
				})	
	})
	
});

app.post('/profileMain',verify,function(req,res){
	var username = req.code.username;
	var sql="select review from user where username=?"
	console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!")
	conn.query(sql,username,function(err,rows,field){
		if(err) console.log("first: "+err)
		if(rows[0].review == null){
			var sql2 = "select profileimg,nickname from user where username = ?"
			conn.query(sql2,username,function(err,rows){
				var profileList = {
					profileimg:rows[0].profileimg,
					nickname:rows[0].nickname
				}
				console.log(profileList.profileimg)
				console.log(profileList.nickname)
				res.send({
					noReviewResult:profileList
				})
			})
			return;
		}
		var reviewsId = rows[0].review.split(",")
		reviewsId.pop();
		console.log(reviewsId)
		
		
		var sql1 = `select * from review where id in (${reviewsId})`;
		conn.query(sql1,function(err,rows,field){
			var even = [];
			var odd = [];
			for(i in rows){
				if(i%2==0){
					even.push(rows[i])
				}else{
					odd.push(rows[i])
				}
			}
			
			var sql2 = "select profileimg,nickname from user where username = ?"
			conn.query(sql2,username,function(err,rows){
				var profileList = {
					even:even,
					odd:odd,
					profileimg:rows[0].profileimg,
					nickname:rows[0].nickname
				}
				console.log(profileList.even);
				console.log(profileList.odd);
				console.log(profileList.profileimg)
				console.log(profileList.nickname)
				res.send({
					result:profileList
				})
			})
		})

	})
})

app.post('/getall',verify,function(req,res){
			var sql = 'select * from review';
			conn.query(sql,function(err,rows,fields){
					res.send({
						reviews:rows
					})		
				})
		})

app.post('/verifyLogin',verify,function(req,res){
	res.send({reviews:"haveToken"})
})

//REATE TABLE `user` (
//			    `id`  tinyint NOT NULL  AUTO_INCREMENT,
//				`username`  varchar(50) NOT NULL ,
//				`password`  varchar(500) NOT NULL ,
//				`key`  varchar(500) NOT NULL ,
//				`profileimg`  varchar(250) NOT NULL default "s3에 디폴드 사진링크",
//				`review` varchar(250),
//				`nickname` varchar(50) not null
//				PRIMARY KEY (`id`)
//				);
app.post('/register',function(req,res){
			var username = req.body.username;
			var nickname = req.body.nickname;
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
							var sql2 = 'insert into user (`username`,`password`,`key`,`nickname`) values(?,?,?,?);';
							var params = [username,hash,salt,nickname];
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



