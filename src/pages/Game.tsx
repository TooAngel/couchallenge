import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import React from 'react';
import Peer from 'peerjs';

import './Game.css';

import { Player } from '../interfaces/Player'
import { Team } from '../interfaces/Team'
import { Role } from '../interfaces/State'
import { GameState } from '../interfaces/GameState'
import { GameMode } from '../interfaces/GameMode'

import Actions from '../components/Actions';
import Hourglass from '../components/Hourglass';
import Players from '../components/Players';
import Scores from '../components/Scores';
import Words from '../components/Words';
import Title from '../components/Title';

const roundDuration = 30;

interface Params {
  id: string;
  leader: string;
}

interface Match {
  params: Params;
}

interface GameProps {
  match: Match;
}

interface State {
  players: Player[],
  words: string[],
  wordActive: string,
  gameState: GameState,
  playerActive: number,
  gameMode: GameMode,
  timer: number,
  server: boolean
}

class Game extends React.Component<GameProps, State> {
  peer: Peer | null;
  stream: MediaStream | null;
  peerId: string | undefined;
  interval: number | undefined;
  serverConnection: Peer.DataConnection | null;

  constructor(props: GameProps) {
    super(props);
    this.peer = null;
    this.stream = null;
    this.peerId = undefined;
    this.interval = undefined;
    this.serverConnection = null;
    let server = false;
    if (this.props.match.params.leader) {
      this.peerId = this.props.match.params.id;
      server = true;
    }
    this.state = {
      players: [{id: '0', team: Team.red, role: Role.explaining, leader: true, score: 0, peerId: this.peerId || '', srcObject: null, connection: null}],
      words: ['Hund', 'Astronaut', 'Mopped', 'Sonnenblume', 'Schildkröte', 'Fahrrad', 'Gartenstuhl', 'Zauberei', 'Holzschrank', 'Drehbuch', 'Brillenputztuch', 'Coronaparty', 'Osterhase', 'Dusche', 'Flüssigseife', 'Alf', 'Prince', 'Sterne', 'Alpha'],
      wordActive: '',
      playerActive: 0,
      gameState: GameState.Waiting,
      gameMode: GameMode.NoSound,
      timer: 300,
      server: server,
    };
    this.setPlayer = this.setPlayer.bind(this);
    this.initRTC = this.initRTC.bind(this);
    this.handleServer = this.handleServer.bind(this);
    this.handleClient = this.handleClient.bind(this);
    this.updateClients = this.updateClients.bind(this);
    this.startRound = this.startRound.bind(this);
    this.handleClientOpenPeer = this.handleClientOpenPeer.bind(this);
    this.wordGuessed = this.wordGuessed.bind(this);
    this.nextWord = this.nextWord.bind(this);

    const media = navigator.mediaDevices.getUserMedia({video: true, audio: true});
    media.then((stream) => {
      this.stream = stream;
      const players = this.state.players;
      players[0].srcObject = this.stream;
      this.setState({players: players});
      this.initRTC();
    });
  }

  wordGuessed() {
    if (this.state.server) {
      const player = this.state.players[this.state.playerActive];
      player.score += 1;
      const word = this.state.words[Math.floor(Math.random() * this.state.words.length)];
      this.setState({players: this.state.players, wordActive: word});
      const data = {
        wordActive: word,
        playerActive: this.state.playerActive,
        gameState: this.state.gameState,
        gameMode: this.state.gameMode,
        timer: this.state.timer,
        words: this.state.words,
        players: this.state.players,
        server: false,
      };
      this.updateClients(data);
    } else {
      if (this.serverConnection === null) {
        console.log('Why is serverConnection null?');
        return;
      }
      this.serverConnection.send(JSON.stringify({action: 'guessed'}));
    }
  }

  nextWord() {
    if (this.state.server) {
      const word = this.state.words[Math.floor(Math.random() * this.state.words.length)];
      this.setState({wordActive: word});
      const data = {
        wordActive: word,
        playerActive: this.state.playerActive,
        gameState: this.state.gameState,
        gameMode: this.state.gameMode,
        timer: this.state.timer,
        words: this.state.words,
        players: this.state.players,
        server: false,
      };
      this.updateClients(data);
    } else {
      if (this.serverConnection === null) {
        console.log('Why is serverConnection null?');
        return;
      }
      this.serverConnection.send(JSON.stringify({action: 'nextWord'}));
    }
  }

  updateClients(config: State) {
    const data = {
      state: {
        wordActive: config.wordActive,
        playerActive: config.playerActive,
        gameState: config.gameState,
        gameMode: config.gameMode,
        timer: config.timer,
      },
      players: config.players
    };
    const replacer = (key: string, value: any) => {
      if (key === 'srcObject' || key === 'connection') {
        return null
      }
      return value;
    };
    const message = JSON.stringify(data, replacer);
    for (const player of this.state.players) {
      if (!player.connection) {
        continue;
      }
      console.log('Send to player', player);
      player.connection.send(message);
    }
  }

  handleServer() {
    let port = 9001;
    if (window.location.protocol === "https:") {
      port = 9002;
    }
    this.peer = new Peer(this.peerId, {
      host: 'peer.couchallenge.de',
      port: port,
      path: '/myapp',
      key: 'cccccc',
    });
    // this.peer.on('open', () => {})

    this.peer.on('connection', (conn) => {
      conn.on('data', (message) => {
        const data = JSON.parse(message);
        if (data.action === 'init') {
          console.log('init');
          this.state.players.push({
            id: `${this.state.players.length}`,
            team: this.state.players.length % 2,
            role: Role.explaining,
            leader: false,
            score: 0,
            peerId: conn.peer,
            srcObject: null,
            connection: conn,
          });
          this.setState({players: this.state.players});
          this.updateClients(this.state);
        } else if (data.action === 'guessed') {
          this.wordGuessed();
        } else if (data.action === 'nextWord') {
          this.nextWord();
        }
      });
    });
    this.peer.on('close', function() { console.log('peer closed'); });
    this.peer.on('disconnected', function() { console.log('peer disconnected'); });
    this.peer.on('error', function(err) { console.log('peer error', err); });
  }

  handleClientOpenPeer(id: string) {
    if (id === null) {
      console.log('handleClientOpenPeer peer.on open id = null, why?');
      return;
    }
    if (this.peer === null) {
      console.log('handleClient peer.on open this.peer = null, why?');
      return;
    }
    this.serverConnection = this.peer.connect(this.props.match.params.id);
    this.serverConnection.on('error', (err) => {console.log('peerConnection error', err);});
    console.log(this.serverConnection.open);
    if (this.serverConnection.open) {
      console.log('is already open');
      this.serverConnection.send(JSON.stringify({action: 'init'}));
    }
    this.serverConnection.on('data', (data) => {
      console.log('receive data');
      const message = JSON.parse(data);

      const players: Player[] = message.players;
      console.log('my id', id);
      for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const player = players[playerIndex];
        console.log(player.id, player.peerId, player.srcObject);
        const oldPlayer = this.state.players.find(element => element.peerId === player.peerId && !!element.srcObject);
        if (oldPlayer) {
          console.log('oldPlayer found');
          player.srcObject = oldPlayer.srcObject;
          continue;
        }

        if (player.peerId === id) {
          console.log('me found');
          player.srcObject = this.stream;
          continue;
        }

        if (this.stream) {
          console.log('call player');
          if (this.peer === null) {
            return;
          }
          const call = this.peer.call(player.peerId, this.stream);
          call.on('stream', (remoteStream) => {
            console.log('call connected');
            console.log(player.id, player.peerId, player.srcObject);
            player.srcObject = remoteStream;
            this.setState({players: players});
          });
        }
        this.setState({players: players});
      }
      const state = message.state;
      if (state.gameState === GameState.Playing) {
        if (!this.interval) {
          this.interval = window.setInterval(() => this.handleTimer(), 1000);
        }
      }
      if (state.gameState === GameState.Waiting) {
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = undefined;
        }
      }
      this.setState({
        players: players,
        wordActive: state.wordActive,
        playerActive: state.playerActive,
        gameState: state.gameState,
        gameMode: state.gameMode,
        timer: state.timer
      });
    });

    this.serverConnection.on('open', () => {
      if (this.serverConnection === null) {
        console.log('Why is serverConnection null?');
        return;
      }
      console.log('send init');
      this.serverConnection.send(JSON.stringify({action: 'init'}));
    })
  }

  handleClient() {
    console.log('handle client');

    let port = 9001;
    if (window.location.protocol === "https:") {
      port = 9002;
    }

    this.peer = new Peer(this.peerId, {
      host: 'peer.couchallenge.de',
      port: port,
      path: '/myapp',
      key: 'cccccc',
    });
    console.log(this.peer);
    this.peer.on('open', (id) => {
      console.log('peer open', id);
      this.peerId = id;
      this.handleClientOpenPeer(id);
    });

    this.peer.on('close', function() { console.log('peer closed'); });
    this.peer.on('disconnected', function() { console.log('peer disconnected'); });
    this.peer.on('error', function(err) {
      console.log('peer error');
      console.log(err);
    });
    this.peer.reconnect();
    if (this.peer.id) {
      this.handleClientOpenPeer(this.peer.id);
    }
  }

  initRTC() {
    if (this.props.match.params.leader) {
      this.handleServer();
    } else {
      this.handleClient();
    }
    if (this.peer === null) {
      console.log('handleClient this.peer = null, why?');
      return;
    }
    this.peer.on('call', (call) => {
      if (this.stream) {
        call.answer(this.stream);
        call.on('stream', (remoteStream) => {
          const player = this.state.players.find((player) => player.peerId === call.peer);
          if (player) {
            player.srcObject = remoteStream;
            this.setState({players: this.state.players})
          } else {
            console.log('Can not find player in players on call', call, this.state.players);
          }
        });

        call.on('close', function() {console.log('call close')});
        call.on('error', (err) => {
          console.log('call error', err);
          const players = this.state.players.filter((player) => player.peerId !== call.peer);
          this.setState({players: players});
        });
      }
    });
  }

  setPlayer(player: Player) {
    const players = this.state.players;
    players[this.state.playerActive] = player;
    this.setState({players: players});
  }

  handleTimer() {
    let timer = this.state.timer - 1;
    if (timer <= 0) {
      this.setState({gameState: GameState.Waiting, timer: timer});
      clearInterval(this.interval);
      this.interval = undefined;
    } else {
      this.setState({timer: timer});
    }
  }

  startRound() {
    const word = this.state.words[Math.floor(Math.random() * this.state.words.length)];
    const player = Math.floor(Math.random() * this.state.players.length);
    const gameMode = Math.floor(Math.random() * 2);
    this.setState({wordActive: word, playerActive: player, gameState: GameState.Playing, gameMode: gameMode, timer: roundDuration});
    this.interval = window.setInterval(() => this.handleTimer(), 1000);
    const data = {
      wordActive: word,
      playerActive: player,
      gameState: GameState.Playing,
      gameMode: gameMode,
      timer: roundDuration,
      words: this.state.words,
      players: this.state.players,
      server: false,
    };
    this.updateClients(data);
  }

  render() {
    const components = [];
    components.push(<Players key="players" players={this.state.players} gameState={this.state.gameState} gameMode={this.state.gameMode} myPeerId={this.peerId} playerActive={this.state.playerActive}/>)
    components.push(<Scores key="scores" players={this.state.players} />);
    components.push(<Hourglass key="hourglass" timeLeft={this.state.timer} />);
    if (this.state.gameState === GameState.Playing && this.state.players[this.state.playerActive].peerId === this.peerId) {
      components.push(<Words key="words" word={this.state.wordActive} />);
    }
    if ((this.state.gameState === GameState.Playing && this.state.players[this.state.playerActive].peerId === this.peerId) ||
        (this.state.gameState === GameState.Waiting && this.state.server)
    ) {
      components.push(<Actions key="actions" player={this.state.players[this.state.playerActive]} setPlayer={this.setPlayer} gameState={this.state.gameState} startRound={this.startRound} server={this.state.server} wordGuessed={this.wordGuessed} nextWord={this.nextWord} />);
    }

    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <Title gameId={this.props.match.params.id} wordActive={this.state.wordActive} playerActive={this.state.playerActive} gameState={this.state.gameState} gameMode={this.state.gameMode} timer={this.state.timer} />
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {components}
        </IonContent>
      </IonPage>
    );
  }
};

export default Game;
