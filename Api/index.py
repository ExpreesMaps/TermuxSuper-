from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone
import json, os, re, socket, ipaddress, platform, time, http.client, urllib.request, urllib.error

class Err(Exception): pass

REGIONS = {'iad1': 'Washington D.C., AS', 'sfo1': 'San Francisco, AS', 'cle1': 'Cleveland, AS', 'pdx1': 'Portland, AS',
    'cdg1': 'Paris, Prancis', 'arn1': 'Stockholm, Swedia', 'dub1': 'Dublin, Irlandia', 'lhr1': 'London, Inggris',
    'fra1': 'Frankfurt, Jerman', 'gru1': 'Sao Paulo, Brasil', 'hkg1': 'Hong Kong', 'bom1': 'Mumbai, India',
    'hnd1': 'Tokyo, Jepang', 'icn1': 'Seoul, Korea Selatan', 'kix1': 'Osaka, Jepang', 'sin1': 'Singapura',
    'syd1': 'Sydney, Australia', 'cpt1': 'Cape Town, Afrika Selatan', 'dxb1': 'Dubai, UEA'}

def get_json(url, timeout=8):
    req = urllib.request.Request(url, headers={'User-Agent': 'TermuxSuper/1.0', 'Accept': 'application/rdap+json, application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as f:
        return json.load(f)

def host_of(s):
    h = re.sub(r'^[a-z]+://', '', s.strip().lower()).split('/')[0].split(':')[0]
    if not re.fullmatch(r'[a-z0-9.-]{1,253}', h) or '.' not in h:
        raise Err('Domain atau IP tidak valid')
    return h

def is_ip(h):
    try: ipaddress.ip_address(h); return True
    except ValueError: return False

def domain(a):
    d = host_of(a)
    try:
        j = get_json('https://rdap.org/domain/' + d)
    except urllib.error.HTTPError as e:
        raise Err('Domain tidak ditemukan di RDAP' if e.code == 404 else f'RDAP membalas HTTP {e.code}')
    try: ips = sorted({x[4][0] for x in socket.getaddrinfo(d, None)})
    except OSError: ips = []
    reg = next((v[3] for e in j.get('entities', []) if 'registrar' in e.get('roles', [])
                for v in (e.get('vcardArray') or [0, []])[1] if v[0] == 'fn'), None)
    return {'domain': j.get('ldhName', d).lower(), 'status': j.get('status', []), 'registrar': reg, 'ips': ips,
            'ns': [n.get('ldhName', '').lower() for n in j.get('nameservers', [])],
            'events': [{'action': e.get('eventAction'), 'date': e.get('eventDate')} for e in j.get('events', [])]}

def ip(a):
    t = host_of(a) if a else None
    if t and not is_ip(t):
        try: t = socket.gethostbyname(t)
        except OSError: raise Err('Domain tidak dapat di-resolve')
    if not t: t = get_json('https://api.ipify.org?format=json')['ip']
    j = get_json('https://ipwho.is/' + t)
    if not j.get('success'): raise Err(j.get('message', 'Lookup IP gagal'))
    c = j.get('connection', {})
    o = {'ip': j['ip'], 'city': j.get('city'), 'region': j.get('region'), 'country': j.get('country'),
         'lat': j.get('latitude'), 'lon': j.get('longitude'), 'tz': (j.get('timezone') or {}).get('id'),
         'isp': c.get('isp'), 'asn': c.get('asn')}
    if not a:
        r = os.environ.get('VERCEL_REGION', '-')
        o.update(vercel=f"{r} ({REGIONS.get(r, 'tidak diketahui')})", aws=os.environ.get('AWS_REGION', '-'))
    return o

def ping(a):
    h = host_of(a)
    plain = is_ip(h) or a.strip().lower().startswith('http://')
    try: addr = socket.gethostbyname(h)
    except OSError: raise Err('Host tidak dapat di-resolve')
    if not ipaddress.ip_address(addr).is_global: raise Err('Alamat internal diblokir')
    res = []
    for _ in range(4):
        t = time.perf_counter()
        try:
            c = (http.client.HTTPConnection if plain else http.client.HTTPSConnection)(h, timeout=2)
            c.request('HEAD', '/', headers={'User-Agent': 'TermuxSuper/1.0'})
            code = c.getresponse().status; c.close()
            res.append({'ms': round((time.perf_counter() - t) * 1000), 'code': code})
        except Exception as e:
            res.append({'ms': None, 'err': type(e).__name__})
    return {'host': h, 'ip': addr, 'scheme': 'http' if plain else 'https', 'results': res}

def system(a):
    m = {}
    try:
        for l in open('/proc/meminfo'):
            k, v = l.split(':'); m[k] = int(v.split()[0]) // 1024
    except OSError: pass
    tot = m.get('MemTotal', 0); used = tot - m.get('MemAvailable', 0)
    return {'os': platform.platform(), 'arch': platform.machine(), 'cpu': os.cpu_count(), 'python': platform.python_version(),
            'time': datetime.now(timezone.utc).isoformat(), 'region': os.environ.get('VERCEL_REGION', '-'),
            'mem_total': tot, 'mem_used': used, 'mem_pct': round(used * 100 / tot) if tot else 0,
            'fn_mem': os.environ.get('AWS_LAMBDA_FUNCTION_MEMORY_SIZE', '-')}

ROUTES = {'domain': domain, 'ip': ip, 'ping': ping, 'system': system}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        fn = ROUTES.get(q.get('cmd', [''])[0])
        try:
            if not fn: raise Err('Endpoint tidak dikenal')
            code, data = 200, fn(q.get('q', [''])[0])
        except Err as e: code, data = 400, {'error': str(e)}
        except Exception as e: code, data = 500, {'error': f'{type(e).__name__}: {e}'}
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)
                                               
