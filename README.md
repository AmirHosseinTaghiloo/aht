::: {align="center" dir="rtl"}
# 🚀 AHT \| وب‌سایت پورتفولیوی شخصی

### ✨ معرفی من، مهارت‌ها و پروژه‌هایم در یک تجربه مدرن و تعاملی

ساخته‌شده با ❤️ و با استفاده از **Nuxt.js** و **Vue.js**


------------------------------------------------------------------------

## 👋 درباره پروژه

**AHT** وب‌سایت پورتفولیوی شخصی من است که با هدف نمایش مهارت‌های فنی،
پروژه‌های توسعه وب و مسیر حرفه‌ای‌ام طراحی شده است.

در این پروژه تلاش کرده‌ام ظاهر مدرن را با تعاملات پویا و تجربه کاربری
واکنش‌گرا ترکیب کنم تا بازدیدکننده بتواند به‌سادگی با من، پروژه‌هایم و
راه‌های ارتباطی‌ام آشنا شود.

## 🌟 قابلیت‌ها

-   🎨 **طراحی مدرن و متمایز** با تمرکز بر هویت بصری و جزئیات رابط
    کاربری
-   📱 **طراحی واکنش‌گرا (Responsive)** برای نمایش مناسب در موبایل و
    دسکتاپ
-   🪄 **انیمیشن‌ها و تعاملات پویا** برای ایجاد تجربه‌ای جذاب‌تر
-   🖱️ **نشانگر ماوس سفارشی** برای تجربه تعاملی متفاوت
-   💻 **بخش معرفی پروژه‌ها** برای نمایش نمونه‌کارهای توسعه وب
-   🔗 **دسترسی سریع به پروفایل‌های حرفه‌ای** مانند GitHub و LinkedIn
-   📄 **دسترسی به رزومه** از طریق وب‌سایت
-   🧩 **توسعه مبتنی بر کامپوننت** با استفاده از اکوسیستم Vue و Nuxt

> ℹ️ قابلیت‌هایی مانند SSR، SSG و رندرینگ ترکیبی به تنظیمات واقعی پروژه
> وابسته‌اند؛ تا پیش از بررسی `nuxt.config.ts` و تنظیمات استقرار، هیچ‌کدام
> را به‌عنوان قابلیت قطعی پروژه معرفی نمی‌کنیم.

## 🛠️ تکنولوژی‌ها

  -----------------------------------------------------------------------
  تکنولوژی                            کاربرد
  ----------------------------------- -----------------------------------
  🟢 [Nuxt.js](https://nuxt.com/)     فریم‌ورک توسعه وب مبتنی بر Vue

  💚 [Vue.js](https://vuejs.org/)     ساخت رابط کاربری کامپوننت‌محور

  ⚙️ JavaScript / TypeScript          منطق برنامه، متناسب با فایل‌های
                                      استفاده‌شده در پروژه

  🎨 CSS و ابزارهای استایل‌دهی پروژه   طراحی رابط کاربری و واکنش‌گرایی

  🌿 Git و GitHub                     مدیریت نسخه و میزبانی کد
  -----------------------------------------------------------------------

*فهرست بالا را با وابستگی‌ها و فایل‌های واقعی مخزن تطبیق بده و موارد
استفاده‌نشده را حذف کن.*

## 🚀 راه‌اندازی پروژه

### 📋 پیش‌نیازها

-   نصب بودن [Node.js](https://nodejs.org/)
-   یکی از Package Managerهای سازگار با فایل قفل پروژه، مانند npm یا
    pnpm

### ۱. دریافت سورس کد

``` bash
git clone https://github.com/AmirHosseinTaghiloo/aht.git
cd aht
```

### ۲. نصب وابستگی‌ها

اگر پروژه از npm استفاده می‌کند:

``` bash
npm install
```

### ۳. اجرای محیط توسعه

``` bash
npm run dev
```

پس از اجرا، آدرس محلی نمایش‌داده‌شده در ترمینال را در مرورگر باز کن؛ این
آدرس معمولاً `http://localhost:3000` است.

### ۴. ساخت نسخه نهایی

``` bash
npm run build
```

برای پیش‌نمایش نسخه Build‌شده، در صورت پشتیبانی اسکریپت پروژه:

``` bash
npm run preview
```

> 💡 برای اطمینان از نام دقیق دستورات، بخش `scripts` در فایل
> `package.json` را بررسی کن و از Package Manager متناسب با فایل قفل
> پروژه استفاده کن.

## 📁 ساختار پروژه

ساختار زیر نمونه‌ای متداول برای پروژه‌های Nuxt است و لزوماً با ساختار دقیق
مخزن یکسان نیست:

``` text
aht/
├── assets/        # 🎨 فایل‌هایی که در فرایند Build پردازش می‌شوند
├── components/    # 🧩 کامپوننت‌های قابل استفاده مجدد
├── pages/         # 🗺️ صفحات و مسیرها، در صورت استفاده
├── public/        # 🖼️ فایل‌های استاتیک
├── app.vue        # 🏠 کامپوننت ریشه، در صورت وجود
├── nuxt.config.ts # ⚙️ تنظیمات Nuxt
└── package.json   # 📦 وابستگی‌ها و اسکریپت‌های پروژه
```

## 🔍 رندرینگ، SEO و عملکرد

Nuxt از روش‌های مختلف رندرینگ پشتیبانی می‌کند:

-   ⚡ **SSG (Static Site Generation):** تولید صفحات استاتیک هنگام Build
-   🌐 **SSR (Server-Side Rendering):** رندر صفحه در سمت سرور هنگام
    درخواست
-   🔀 **Hybrid Rendering:** استفاده از راهبردهای متفاوت برای مسیرهای
    مختلف

روش واقعی استفاده‌شده در AHT باید با بررسی `nuxt.config.ts`، قوانین
مسیرها، دستورات Build و تنظیمات استقرار مشخص شود. همچنین بهتر است وضعیت
متادیتای SEO، تگ‌های Open Graph، دسترس‌پذیری و بهینه‌سازی عملکرد بر اساس
پیاده‌سازی واقعی پروژه مستند شود.

## 🧭 مسیر توسعه

ایده‌هایی برای بهبودهای آینده:

-   📱 بهبود بیشتر تعاملات و تجربه موبایل
-   ♿ بررسی و ارتقای دسترس‌پذیری
-   ⚡ ارزیابی و بهینه‌سازی عملکرد
-   🧪 بررسی تنظیمات رندرینگ و SEO و مستندسازی نتایج واقعی
-   🗂️ افزودن توضیحات فنی و جزئیات بیشتر برای هر پروژه

## 👨‍💻 درباره توسعه‌دهنده

**امیرحسین تقی‌لو**\
🎓 دانشجوی مهندسی کامپیوتر \| 💻 توسعه‌دهنده فرانت‌اند

-   🐙 **GitHub:**
    [AmirHosseinTaghiloo](https://github.com/AmirHosseinTaghiloo)
-   💼 **LinkedIn:** [Amir Hossein
    Taghiloo](https://www.linkedin.com/in/amir-taghiloo-605928248/)

## 💬 بازخورد و مشارکت

اگر پیشنهاد، ایده یا گزارشی درباره مشکلی در پروژه داری، می‌توانی از طریق
بخش **Issues** در مخزن GitHub آن را مطرح کنی.

------------------------------------------------------------------------

::: {align="center" dir="rtl"}
### 💚 ممنون که از پروژه AHT بازدید کردی!

**ساخته‌شده با Nuxt.js و Vue.js توسط امیرحسین تقی‌لو**
:::




::: {align="center"}
# AHT --- Personal Portfolio

**A modern, interactive portfolio built with Nuxt.js and Vue.js**

Showcasing projects, technical skills, and professional links through a
responsive, visually engaging experience.

[![Nuxt](https://img.shields.io/badge/Nuxt.js-4-00DC82?style=for-the-badge&logo=nuxtdotjs&logoColor=white)](https://nuxt.com/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Portfolio](https://img.shields.io/badge/Portfolio-AHT-111827?style=for-the-badge)](https://github.com/AmirHosseinTaghiloo/aht)
:::

------------------------------------------------------------------------

## Overview

**AHT** is a personal portfolio website created to present my work,
skills, and professional profile in one place. The project focuses on a
modern visual identity, interactive details, and a responsive layout
designed to work across desktop and mobile screens.

The portfolio brings together project highlights and quick access to my
professional profiles and résumé, with motion and visual effects used to
make the experience more engaging.

## Highlights

-   **Personal portfolio experience** --- a central place to introduce
    my work and professional profile.
-   **Responsive layout** --- designed to adapt to desktop and mobile
    screen sizes.
-   **Interactive visual details** --- animated elements and motion
    effects that add depth to the interface.
-   **Custom cursor experience** --- a more distinctive way to interact
    with the site.
-   **Project showcase** --- a place to highlight selected development
    projects.
-   **Professional links** --- quick access to GitHub, LinkedIn, and
    résumé information.
-   **Nuxt.js and Vue.js architecture** --- component-based development
    with the Vue ecosystem.

> Rendering mode (SSR, SSG, or hybrid) depends on the project's actual
> Nuxt configuration and deployment setup; it is intentionally not
> claimed here without verification.

## Tech Stack

  -----------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- -----------------------------------
  [Nuxt.js](https://nuxt.com/)        Application framework and routing

  [Vue.js](https://vuejs.org/)        Component-based user interface

  JavaScript / TypeScript             Application logic, depending on the
                                      files used

  CSS / project styling tools         Layout, responsive design, and
                                      visual effects

  Git & GitHub                        Version control and source-code
                                      hosting
  -----------------------------------------------------------------------

*Keep this list aligned with the dependencies and files in the current
repository. Remove any technology that is not actually used.*

## Getting Started

### Prerequisites

-   Node.js (use a version compatible with the project's Nuxt version)
-   npm, pnpm, yarn, or another package manager supported by the
    lockfile

### Installation

Clone the repository:

``` bash
git clone https://github.com/AmirHosseinTaghiloo/aht.git
cd aht
```

Install dependencies using the package manager matching the lockfile in
the repository. For example:

``` bash
npm install
```

### Run the development server

``` bash
npm run dev
```

Open the local URL printed in the terminal (commonly
`http://localhost:3000`).

### Build for production

``` bash
npm run build
```

To preview the production build locally:

``` bash
npm run preview
```

> Check `package.json` for the exact scripts and use the package manager
> associated with the repository's lockfile.

## Project Structure

A typical Nuxt project may use the following directories. The exact
structure can vary by project:

``` text
aht/
├── assets/       # Stylesheets and assets processed by the build
├── components/   # Reusable Vue components
├── pages/        # File-based routes, if used
├── public/       # Static files served as-is
├── app.vue       # Root application component, if present
├── nuxt.config.ts
└── package.json
```

## Rendering, Performance & SEO

Nuxt supports multiple rendering strategies, including server-side
rendering (SSR), static site generation (SSG), and hybrid rendering. The
strategy used by AHT should be confirmed from `nuxt.config.ts`, route
rules, build commands, and deployment configuration before describing it
as a project feature.

Likewise, SEO metadata, Open Graph tags, accessibility, and performance
optimizations should be documented according to what is implemented in
the current source code.

## Roadmap

Potential improvements for the project include:

-   Further refinement of mobile interactions and responsive behavior.
-   Continued performance and accessibility checks.
-   Clear project case studies with goals, implementation details, and
    outcomes.
-   Verified SEO metadata and rendering configuration documentation.

## Author

**Amir Hossein Taghiloo**\
Computer Engineering student · Frontend Developer

-   **GitHub:**
    [AmirHosseinTaghiloo](https://github.com/AmirHosseinTaghiloo)
-   **LinkedIn:** [Amir Hossein
    Taghiloo](https://www.linkedin.com/in/amir-taghiloo-605928248/)

## Feedback

Suggestions, issues, and feedback are welcome. Please open an issue in
this repository to discuss a potential improvement.

------------------------------------------------------------------------

::: {align="center"}
Made with Nuxt.js and Vue.js by **Amir Hossein Taghiloo**
:::
