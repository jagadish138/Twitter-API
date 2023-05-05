const express = require("express");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");

app.use(express.json());

const dbpath = path.join(__dirname, "twitterClone.db");

let data = null;
const initializeDbAndServer = async () => {
  try {
    data = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`db error:${e.message}`);
  }
};
initializeDbAndServer();

function authentication(request, response, next) {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  const authenToken = request.headers["authorization"];
  let jwtTokenPermis;
  jwtTokenPermis = authenToken.split(" ")[1];
  if (authenToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtTokenPermis, "my_word_hello", (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
        response.status(401);
      } else {
        request.payload = payload;
        request.tweet = tweet;
        request.tweetId = tweetId;
        next();
      }
    });
  }
}

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const encryptedpass = await bcrypt.hash(password, 10);
  const registeredData = `
    SELECT
    *
    FROM user
    WHERE
    username='${username}';
    `;
  const registerUserDetails = await data.get(registeredData);

  if (registerUserDetails === undefined) {
    if (password.lenght < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const newRegister = `
            INSERT INTO user
            (username,name,password,gender)
            VALUES
            ('${username}','${name}','${encryptedpass}','${gender}')
            `;
      const newJoin = await data.run(newRegister);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const tweetRegisteredData = `
    SELECT
    *
    FROM user
    WHERE
    username='${username}';
    `;
  const registerTweetUserDetails = await data.get(tweetRegisteredData);
  const encryptedpass = await bcrypt.hash(password, 10);

  if (registerTweetUserDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPass = await bcrypt.compare(
      password,
      registerTweetUserDetails.password
    );
    if (checkPass) {
      const jwtToken = await jwt.sign(
        registerTweetUserDetails,
        "my_word_hello"
      );
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const perticularUserTweet = `
    SELECT
    username,tweet,date_time AS datetime
    FROM follower
    INNER JOIN tweet ON follower.following_user_id=tweet.user_id
    INNER JOIN user ON follower.following_user_id=user.user_id
    WHERE
    follower.follower_user_id='${user_id}'
    ORDER BY date_time DESC
    LIMIT 4;
    `;
  const getAllTweets = await data.all(perticularUserTweet);
  response.status(200);
  response.send(getAllTweets);
});

app.get("/user/following/", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const perticularUser = `
    SELECT
    username
    FROM follower
    INNER JOIN user ON follower.following_user_id=user.user_id
    WHERE
    follower.follower_user_id='${user_id}'
   
   
    `;
  const getAllUser = await data.all(perticularUser);
  response.status(200);
  response.send(getAllUser);
});

app.get("/user/followers/", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const followersForMe = `
    SELECT
    username
    FROM follower
    INNER JOIN user ON follower.follower_user_id=user.user_id
    WHERE
    follower.following_user_id='${user_id}'
   
   
    `;
  const getAllfollowers = await data.all(followersForMe);
  response.status(200);
  response.send(getAllfollowers);
});

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const requestedUser = `
    SELECT
    *
    FROM tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id INNER JOIN like ON 
            like.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE 
            follower.follower_user_id = ${user_id} AND tweet.tweet_id = ${tweetId}
   
    `;
  const getReguestedUser = await data.get(requestedUser);
  if (getReguestedUser === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send(getReguestedUser);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const requestedUser = `
    SELECT
    *
    FROM tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id INNER JOIN like ON 
            like.tweet_id = tweet.tweet_id INNER JOIN user ON user.user_id = like.user_id
        WHERE 
            follower.follower_user_id = ${user_id} AND tweet.tweet_id = ${tweetId}
   
    `;
    const getReguestedUser = await data.all(requestedUser);

    if (getReguestedUser.lenght !== 0) {
      let likes = [];
      for (let item of getReguestedUser) {
        likes.push(item.username);
      }
      response.status(200);
      response.send({ likes });
    } else {
      response.status(200);
      response.send(getReguestedUser);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    const requestedUser = `
    SELECT
    *
    FROM follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id 
                INNER JOIN user ON user.user_id = reply.user_id
       
            WHERE 
            follower.follower_user_id = ${user_id} AND tweet.tweet_id = ${tweetId}
   
    `;
    const getReguestedUser = await data.all(requestedUser);

    if (getReguestedUser.lenght !== 0) {
      let replies = [];
      for (let item of getReguestedUser) {
        replies.push({
          name: item.username,
          reply: item.reply,
        });
      }
      response.status(200);
      response.send({ replies });
    } else {
      response.status(200);
      response.send(getReguestedUser);
    }
  }
);

app.get("/user/tweets/", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const requestedUser = `
        SELECT 
            tweet,
            COUNT(like.user_id) AS likes,
            COUNT(reply.reply) AS replies,
            date_time AS dateTime
        FROM 
            tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE 
               tweet.user_id = ${user_id}
        GROUP BY 
            tweet
        ;`;
  const getReguestedUser = await data.all(requestedUser);

  response.send(getReguestedUser);
});

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request;

  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const addTweet = `
    INSERT INTO tweet
    (tweet,user_id)
    VALUES
    ('${tweet}','${user_id}')
 `;
  const addNewTweet = await data.run(addTweet);
  response.send("Created a Tweet");
});
app.delete("/tweets/:tweetId", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;

  const selectUserQuery = `SELECT * FROM tweet WHERE tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;
  const deltweetUser = await data.all(selectUserQuery);
  if (deltweetUser.length !== 0) {
    const deleteTweetQuery = `
        DELETE FROM tweet
        WHERE 
            tweet.user_id =${user_id} AND tweet.tweet_id =${tweetId}
    ;`;
    await data.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
