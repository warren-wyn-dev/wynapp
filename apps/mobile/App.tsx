import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Set with EXPO_PUBLIC_API_ORIGIN when starting the app. Defaults to the
// local API port used everywhere else in this repo's local/E2E setup.
const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

type Screen = 'login' | 'register' | 'feed';

type FeedDrop = {
  id: string;
  body: string | null;
  created_at: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `request failed (${response.status})`);
  }
  return (body?.data ?? body) as T;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<FeedDrop[]>([]);

  const loadFeed = useCallback(async () => {
    setStatus('loading');
    try {
      const page = await api<{ items: FeedDrop[] }>(
        '/v1/feed/for-you?limit=20',
      );
      setItems(page.items ?? []);
      setStatus('idle');
    } catch (error) {
      setMessage((error as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (screen === 'feed') void loadFeed();
  }, [screen, loadFeed]);

  async function register() {
    setStatus('loading');
    setMessage('');
    try {
      await api('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username, displayName }),
      });
      setStatus('idle');
      setMessage('สมัครสำเร็จ — ตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วเข้าสู่ระบบ');
      setScreen('login');
    } catch (error) {
      setMessage((error as Error).message);
      setStatus('error');
    }
  }

  async function login() {
    setStatus('loading');
    setMessage('');
    try {
      await api('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStatus('idle');
      setScreen('feed');
    } catch (error) {
      setMessage((error as Error).message);
      setStatus('error');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>WYN</Text>

      {screen === 'register' && (
        <View style={styles.card}>
          <Text style={styles.heading}>สร้างบัญชี</Text>
          <TextInput
            style={styles.input}
            placeholder="ชื่อที่แสดง"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            placeholder="ชื่อผู้ใช้"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="อีเมล"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            style={styles.button}
            disabled={status === 'loading'}
            onPress={() => void register()}
          >
            <Text style={styles.buttonText}>
              {status === 'loading' ? 'กำลังสร้าง…' : 'สมัครสมาชิก'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setScreen('login')}>
            <Text style={styles.link}>มีบัญชีแล้ว? เข้าสู่ระบบ</Text>
          </Pressable>
        </View>
      )}

      {screen === 'login' && (
        <View style={styles.card}>
          <Text style={styles.heading}>เข้าสู่ระบบ</Text>
          <TextInput
            style={styles.input}
            placeholder="อีเมล"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            style={styles.button}
            disabled={status === 'loading'}
            onPress={() => void login()}
          >
            <Text style={styles.buttonText}>
              {status === 'loading' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setScreen('register')}>
            <Text style={styles.link}>ยังไม่มีบัญชี? สมัครสมาชิก</Text>
          </Pressable>
        </View>
      )}

      {screen === 'feed' && (
        <View style={styles.card}>
          <View style={styles.feedHeader}>
            <Text style={styles.heading}>พื้นที่ของคุณ</Text>
            <Pressable onPress={() => void loadFeed()}>
              <Text style={styles.link}>รีเฟรช</Text>
            </Pressable>
          </View>
          {status === 'loading' && <ActivityIndicator />}
          {status !== 'loading' && items.length === 0 && (
            <Text style={styles.muted}>ยังไม่มี Drop ที่แนะนำ</Text>
          )}
          {items.map((item) => (
            <View key={item.id} style={styles.dropCard}>
              <Text>{item.body}</Text>
            </View>
          ))}
        </View>
      )}

      {message.length > 0 && (
        <Text
          style={status === 'error' ? styles.errorText : styles.statusText}
        >
          {message}
        </Text>
      )}

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#5b21b6',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#5b21b6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  link: {
    color: '#5b21b6',
    textAlign: 'center',
  },
  muted: {
    color: '#71717a',
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropCard: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    padding: 12,
  },
  statusText: {
    color: '#15803d',
    textAlign: 'center',
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
  },
});
