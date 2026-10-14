import { 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

export type AuthStateCallback = (user: User | null, isInitializing: boolean) => void;

class AuthService {
  private currentUser: User | null = null;
  private isInitializing: boolean = true;
  private listeners: AuthStateCallback[] = [];

  constructor() {
    if (isFirebaseConfigured && auth) {
      onAuthStateChanged(auth, (user) => {
        this.currentUser = user;
        this.isInitializing = false;
        this.notifyListeners();
      });
    } else {
      this.isInitializing = false;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      callback(this.currentUser, this.isInitializing);
    });
  }

  public subscribe(callback: AuthStateCallback): () => void {
    this.listeners.push(callback);
    callback(this.currentUser, this.isInitializing);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getIsInitializing(): boolean {
    return this.isInitializing;
  }

  public async signIn(email: string, pass: string): Promise<User> {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase aún no está configurado. Por favor ingresa las credenciales en las variables de entorno.');
    }
    const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return credential.user;
  }

  public async signOut(): Promise<void> {
    if (!auth) return;
    await fbSignOut(auth);
  }
}

export const authService = new AuthService();
