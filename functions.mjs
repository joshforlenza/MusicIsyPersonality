import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import mongoose from 'mongoose';

const User = mongoose.model('User');
const Summary = mongoose.model('Summary');

  /**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
   export const generateRandomString = function(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

export const getToken = async (client_id, client_secret, code, redirect_uri) => {
    const result = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded', 
            'Authorization' : 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri,
        }),
    });

    const data = await result.json();
    return data;
}

export const getTokenWithRefresh = async (client_id, client_secret, refresh_token) => {
    const result = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded', 
            'Authorization' : 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }),
    });

    const data = await result.json();
    return data;
}

export const useAccessToken = async (url, access_token) => {
    const result = await fetch(url, {
        headers: {
            'Authorization' : 'Bearer ' + access_token 
        }
    });

    const data = await result.json();
    console.log(result.status);
    return data;
}

export const getObscurityStat = (tracks) => {
    let sum = 0;
    if(tracks.length===0){ //not enough data to produce stat
        return NaN;
    }
    for(let i=0; i<tracks.length; i++){
        const track = tracks[i];
        sum += track.popularity/100;
    }

    return (sum/tracks.length).toFixed(2);
}

export const pickSummary = async (popStat) => {
    let summary;
    if(popStat>0.70){
      try {
          summary = await Summary.findOne({name:"zeroTaste"}).exec();
          

      } catch (err){
          console.error(err);
      }
      
    }
    else if(popStat>0.40){
        try {
            summary = await Summary.findOne({name:"average"}).exec();
            

        } catch (err){
            console.error(err);
        }
    }
    else if(popStat>0.10){
        try {
            summary = await Summary.findOne({name:"almostSnob"}).exec();
            

        } catch (err){
            console.error(err);
        }
    }
    else if(popStat<0.10){
        try {
            summary = await Summary.findOne({name:"musicSnob"}).exec();
            

        } catch (err){
            console.error(err);
        }
    }
    return summary;
}

export const startAuthenticatedSession = (req, user, cb) => {
    req.session.regenerate((err) => {
      if (!err) {
        req.session.user = user;
      } else {
        console.err(err);
      }
      cb(err);
    });
  };
  
export const endAuthenticatedSession = (req, cb) => {
    req.session.destroy((err) => { cb(err); });
};
  
export const login = (userData, authToken, callback) => {
    const username = userData.display_name;
    User.findOne({username:username},async (err, result) => {
        if(result){
          console.log("USER HAS ALREADY LOGGED IN");
          const response = await useAccessToken("https://api.spotify.com/v1/me/top/tracks",authToken);
          const topTracks = response.items;
          const popStat = getObscurityStat(topTracks);
          if(popStat===NaN){
            result.authToken = authToken;
            await result.save();
            callback(result);
          }
          else{
            const summary = await pickSummary(popStat);
            //update stats on each login
            result.authToken = authToken;
            result.stats.obscurity = popStat;
            result.summary = summary._id;
            await result.save();
            callback(result);
          }

        }
        else if (err){
            console.err(err);
        }
        else{ //create user
            const response = await useAccessToken("https://api.spotify.com/v1/me/top/tracks",authToken);
            const topTracks = response.items;
            const popStat = getObscurityStat(topTracks);
            if(popStat===NaN){
                const newUser = new User({
                  username: userData.display_name,
                  authToken: authToken
                });
                newUser.save(function(err,user){
                    if(err){
                        console.error(err);
                      }
                    else{
                        callback(user);
                    }
                })
            }
            else{
                const summary = await pickSummary(popStat);
                const newUser = new User({
                    username: userData.display_name,
                    authToken: authToken,
                    stats: {obscurity: popStat},
                    summary: summary._id
                });
                newUser.save(function(err,user){
                    if(err){
                        console.error(err);
                      }
                    else{
                        callback(user);
                    }
                })
            }
            
        }
      });
    
  };

export const authRequired = authRequiredPaths => {
    return (req, res, next) => {
      if(authRequiredPaths.includes(req.path)) {
        if(!req.session.user) {
          res.redirect('/'); 
        } else {
          next(); 
        }
      } else {
        next(); 
      }
    };
  };




