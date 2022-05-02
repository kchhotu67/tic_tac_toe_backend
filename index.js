const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors:{
    origin: "http://localhost:3000",
    methods: ['GET', 'POST'],
  },
});


const rooms = {}; // key roomId, value: gameData 
const names = {} // key: playerId, value: playerName
const roomsId = {} // key: playerId, value: roomId
const roomIdByRoomName = {} //key:roomName , value: roomId

const initialBoard = {
  one:'',
  two: '',
  three: '',
  four: '',
  five: '',
  six: '',
  seven: '',
  eight: '',
  nine: '',
}

io.on('connection', socket => {
  io.to(socket.id).emit('your-id', socket.id);
  
  socket.on("disconnect", () => {
    handleSocketDisconnect(socket);
    console.log(Object.keys(rooms).length);
	});

	socket.on("join", (name) => {
		handleSocketJoin(socket, name);
    console.log(Object.keys(rooms).length);
	})

  socket.on('update-move', (data) => {
    rooms[data.id] = data;
    const winData = checkWin(rooms[data.id]);
    io.in(data.id).emit('catch-move', rooms[data.id]);
    if(winData){
      io.to(data.id).emit('game-over', winData);
      setTimeout(() => {
        let roomId = roomsId[socket.id];
        const x = rooms[roomId];
        rooms[roomId] = {
          id:x.id,
          players: x.players,
          turn: x.turn,
          [x.players[0]]: names[x.players[0]],
          [x.players[1]]: names[x.players[1]],
          totalMatch: x.totalMatch+1,
          symbol:{
            [x.players[0]]: x.symbol[x.players[1]],
            [x.players[1]]: x.symbol[x.players[0]],
          },
          active: true,
          board: initialBoard,
          type: x.type,
          roomName: x.roomName,
        }
        if(winData.winner){
          rooms[roomId].result = {...x.result, [winData.winner]: x.result[winData.winner]+1}
        }else{
          rooms[roomId].result = {...x.result, tie: x.result['tie']+1}
        }
        io.to(data.id).emit('starting-new-game', rooms[roomId]);
      }, 3000)
      
    }
  })

  socket.on("private-room-join", ({playerName, roomName}) => {
    handlePrivateRoomJoin(socket, playerName, roomName);
    console.log(Object.keys(rooms).length);
  })
})

const handleSocketJoin = (socket, name) => {
  names[socket.id] = name; //storing name
  console.log(`${name} has enter into game.`)
  const keys = Object.keys(rooms);
  let roomId = null;
  for(let i=0;i<keys.length;i++){
    if(rooms[keys[i]].players.length === 1 && rooms[keys[i]].type === 'public'){
      roomId = keys[i];
      break;
    }
  }
  if(roomId){
    rooms[roomId].players.push(socket.id);
    rooms[roomId].result[socket.id] = 0;
    rooms[roomId].symbol[socket.id] = rooms[roomId].symbol[rooms[roomId].players[0]] === 'X' ?'O': 'X';
    rooms[roomId].active = true;
    rooms[roomId][socket.id] = names[socket.id];
    roomsId[socket.id] = roomId;//stroring roomId
    socket.join(roomId);
    io.in(roomId).emit('game-instance', rooms[roomId]);
  }else{
    const newRoomId = Math.floor(Math.random()*100000000)+'';
    rooms[newRoomId] = {
      id:newRoomId,
      players: [socket.id],
      [socket.id]: names[socket.id],
      turn: socket.id,
      totalMatch: 0,
      result: {
        [socket.id]: 0,
        tie: 0,
      },
      symbol:{
        [socket.id]:'X',
      },
      board: {
        one:'',
        two: '',
        three: '',
        four: '',
        five: '',
        six: '',
        seven: '',
        eight: '',
        nine: '',
      },
      active: false,
      type: 'public',
      roomName: 'Unknown',
    }
    roomsId[socket.id] = newRoomId; // storing room id
    socket.join(newRoomId);
    io.to(socket.id).emit('game-instance', rooms[newRoomId]);
  }
}

const handlePrivateRoomJoin = (socket, playerName, roomName) => {
  names[socket.id] = playerName; // store name of player
  if(roomIdByRoomName[roomName]){
    const roomId = roomIdByRoomName[roomName];
    if(rooms[roomId].players.length === 2){
      delete names[socket.id];
      io.to(socket.id).emit('room-full', roomName);
    }else{
      rooms[roomId].players.push(socket.id);
      rooms[roomId].result[socket.id] = 0;
      rooms[roomId].symbol[socket.id] = rooms[roomId].symbol[rooms[roomId].players[0]] === 'X' ?'O': 'X';
      rooms[roomId].active = true;
      rooms[roomId][socket.id] = names[socket.id];
      roomsId[socket.id] = roomId;
      socket.join(roomId);
      io.in(roomId).emit('game-instance', rooms[roomId]);
    }
  }else{
    const newRoomKey = Math.floor(Math.random()*100000000)+'';
    roomIdByRoomName[roomName] = newRoomKey; // store name to room id mapping
    rooms[newRoomKey] = {
      id:newRoomKey,
      players: [socket.id],
      [socket.id]: names[socket.id],
      turn: socket.id,
      totalMatch: 0,
      result: {
        [socket.id]: 0,
        tie: 0,
      },
      symbol:{
        [socket.id]:'X',
      },
      board: {
        one:'',
        two: '',
        three: '',
        four: '',
        five: '',
        six: '',
        seven: '',
        eight: '',
        nine: '',
      },
      active: false,
      type: 'private',
      roomName: roomName,
    }
    roomsId[socket.id] = newRoomKey;
    socket.join(newRoomKey);
    io.to(socket.id).emit('game-instance', rooms[newRoomKey]);
  }
}
const getOtherPlayerId = (gameData) => {
  if(gameData.players[0] === gameData.turn){
    return gameData.players[1];
  }
  return gameData.players[0];
}

const checkWin = (gameData) => {
  const playerT = getOtherPlayerId(gameData);
  const pointer = gameData.symbol[playerT];
  board = gameData.board;

  if(board.one === board.two && board.two === board.three && board.three === pointer){
    return {winner: playerT, crossLine: 'hor-1'}
  }else if(board.four === board.five && board.five === board.six && board.six === pointer){
    return {winner: playerT, crossLine: 'hor-2'}
  }
  else if(board.seven === board.eight && board.eight === board.nine && board.nine === pointer){
    return {winner: playerT, crossLine: 'hor-3'}
  }else if(board.one === board.four && board.one === board.seven && board.seven === pointer){
    return {winner: playerT, crossLine: 'ver-1'}
  }else if(board.two === board.five && board.five === board.eight && board.eight === pointer){
    return {winner: playerT, crossLine: 'ver-2'}
  }else if(board.three === board.six && board.six === board.nine && board.nine === pointer){
    return {winner: playerT, crossLine: 'ver-3'}
  }else if(board.one === board.five && board.five === board.nine && board.nine === pointer){
    return {winner: playerT, crossLine: 'cross-1'}
  }else if(board.three === board.five && board.five === board.seven && board.seven === pointer){
    return {winner: playerT, crossLine: 'cross-2'}
  }

  let count = 0;
  Object.keys(board).forEach((key) => {
    if(board[key] !== ''){
      count++;
    }
  });

  if(count ===  9){
    return {winner: ''};
  }
  return null;
}

const handleSocketDisconnect = (socket) => {
  if(!names[socket.id] || !roomsId[socket.id]){
    return;
  }
  console.log(`${names[socket.id]} leaving the game`);
  delete names[socket.id]; //deleting name from name list
  const roomId = roomsId[socket.id];
  if(rooms[roomId].players.length == 1){
    const roomName = rooms[roomId].roomName;
    delete roomsId[socket.id];
    delete rooms[roomId];
    delete roomIdByRoomName[roomName];
  }else{
    const first = rooms[roomId].players[0];
    const second = rooms[roomId].players[1];
    if(first === socket.id){
      io.to(second).emit('opponent-left');
      setTimeout(() => {
        rooms[roomId].players.splice(0, 1);
        delete rooms[roomId].result[first] ;
        rooms[roomId].result[second] = 0;
        rooms[roomId].result['tie'] = 0;
        rooms[roomId].symbol[second] = 'X';
        delete rooms[roomId].symbol[first] ;
        rooms[roomId].turn = second;
        rooms[roomId].active = false;
        rooms[roomId].board = initialBoard;
        delete rooms[roomId][first] ;
        delete roomsId[first];
        io.in(second).emit('game-instance', rooms[roomId]);
      }, 3000)
    }else{
      io.to(first).emit('opponent-left');
      setTimeout(() => {
        rooms[roomId].players.splice(1, 1);
        delete rooms[roomId].result[second] ;
        rooms[roomId].result[first] = 0;
        rooms[roomId].result['tie'] = 0;
        rooms[roomId].symbol[first] = 'X';
        delete rooms[roomId].symbol[second] ;
        rooms[roomId].turn = first;
        rooms[roomId].board = initialBoard;
        rooms[roomId].active = false;
        delete rooms[roomId][second] ;
        delete roomsId[second] ;
        io.in(first).emit('game-instance', rooms[roomId]);
      }, 3000)
    }
  }
}


server.listen(3001, () => {
  console.log('Server is Listning on port 3001');
});