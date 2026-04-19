import requests
from bs4 import BeautifulSoup
html = requests.get('https://zenithconventschoolgkp.com/School_Uniform.aspx').text
soup = BeautifulSoup(html, 'html.parser')
for img in soup.find_all('img'):
    src = img.get('src')
    if src: print(src)
