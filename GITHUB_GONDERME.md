# Projeyi GitHub’a Gönderme – Mobil’den Ulaşmak İçin

Bu projeyi GitHub’a atınca **github.com** veya **GitHub Mobile** uygulamasından her yerden erişebilirsiniz.

---

## 1. Bilgisayarda (şu an)

### A) Git yüklü mü?
- **Windows:** [git-scm.com](https://git-scm.com/download/win) → İndir, kur.
- Kurduktan sonra **yeni bir terminal** açın.

### B) Proje klasörüne gidin
```bash
cd "C:\Users\MİSAFİR\Downloads\Aren-cursor-user-greeting-handling-d8ec\Aren-cursor-user-greeting-handling-d8ec"
```
*(Tek bir “Aren-cursor-user-greeting-handling-d8ec” klasörü varsa, doğrudan o klasörün içine gidin.)*

### C) Repo başlatıp ilk commit
```bash
git init
git add .
git commit -m "Ilk commit: mac onu, gulisuckac, app"
```

### D) GitHub’da yeni repo oluşturun
1. Tarayıcıdan **https://github.com** → Giriş yapın.
2. Sağ üst **+** → **New repository**.
3. **Repository name:** `aren-turk-futbol` (veya istediğiniz isim).
4. **Public** seçin.
5. **Create repository** (README eklemenize gerek yok).

### E) Uzak repo bağlayıp gönderin
GitHub sayfasında gösterilen **repo URL’sini** (örn. `https://github.com/KULLANICI_ADINIZ/aren-turk-futbol.git`) kullanın:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/aren-turk-futbol.git
git branch -M main
git push -u origin main
```

- İlk push’ta GitHub kullanıcı adı ve **Personal Access Token** (şifre yerine) istenir.  
- Token: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token** (repo yetkisi verin).

---

## 2. Mobil’den erişim

### Web (telefon tarayıcısı)
- **https://github.com/KULLANICI_ADINIZ/aren-turk-futbol** adresine gidin.
- Klasörlere tıklayarak **yeni_proje**, **gulisuckac**, **app** içeriklerini görüntüleyin.
- Dosyaya tıklayınca içeriği ve **Raw** / **Edit** (giriş yaptıysanız) kullanabilirsiniz.

### GitHub Mobile uygulaması
1. **GitHub Mobile**’ı indirin (iOS/Android).
2. Hesabınızla giriş yapın.
3. **Repositories** → **aren-turk-futbol** (veya verdiğiniz isim).
4. Dosya/klasörlere dokunup içerikleri okuyup düzenleyebilirsiniz; basit düzenlemeler mobilde de yapılır.

---

## 3. Sonraki değişiklikleri göndermek (bilgisayarda)

Projede değişiklik yaptıktan sonra:

```bash
cd "C:\Users\MİSAFİR\Downloads\Aren-cursor-user-greeting-handling-d8ec\Aren-cursor-user-greeting-handling-d8ec"
git add .
git commit -m "Ne degistirdiyseniz kisa yazin"
git push
```

Bundan sonra aynı repo’ya mobil veya web’den anında ulaşırsınız.

---

## Kısa özet

| Ne yapıyorsunuz?        | Nerede?        |
|-------------------------|----------------|
| Repo oluşturma + ilk push | Bilgisayar (terminal) |
| Dosyalara bakma / küçük düzenleme | github.com veya GitHub Mobile |
| Büyük güncellemeleri push etme | Bilgisayar (terminal) |

Repo linki: **https://github.com/KULLANICI_ADINIZ/REPO_ADI** — Bunu sık kullanılanlara ekleyin; mobilde web’den hemen açarsınız.
