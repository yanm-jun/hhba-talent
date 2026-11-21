"""Synthetic real MS Word/OOXML documents with noise images (no user data)."""
from pathlib import Path
import os
from docx import Document
from docx.shared import Cm
from PIL import Image
ROOT=Path('/tmp/hhba-word-cpu')
ROOT.mkdir(parents=True,exist_ok=True)
for name,sz in [('small',220),('medium',700),('large',990)]:
    height=sz
    raw=os.urandom(sz*height*3)
    pic=ROOT/(name+'.png')
    Image.frombytes('RGB',(sz,height),raw).save(pic,format='PNG',compress_level=1)
    doc=Document()
    doc.add_heading('HHBA 虚构求职简历 — Workers CPU QA',level=1)
    doc.add_paragraph('负责门店运营及日常数据整理工作')
    doc.add_paragraph('仅用于压力测试，素材由程序随机生成，不包含真实个人资料。')
    doc.add_picture(str(pic),width=Cm(11))
    dest=ROOT/(name+'.docx')
    doc.save(dest)
    print('HHBA_PRESSURE_DOCX',name,dest.stat().st_size)
