import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import React from 'react';
import CreateGame from '../components/CreateGame';
import JoinGame from '../components/JoinGame';
import './Home.css';

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Couchallenge</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <img src="/assets/logo.svg" width="100%" />
        <CreateGame />
        <JoinGame />
      </IonContent>
    </IonPage>
  );
};

export default Home;
