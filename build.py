import json,sys,pathlib
src=pathlib.Path('web/index.src.html').read_text()
snap=pathlib.Path(sys.argv[1]).read_text()
snap=snap.replace('</','<\\/')
pathlib.Path('dist').mkdir(exist_ok=True)
feat=pathlib.Path('web/features.js').read_text()
src=src.replace('/*__FEATURES__*/',feat)
api=sys.argv[2] if len(sys.argv)>2 else None
out=src.replace('__SNAPSHOT__',snap)
if api: out=out.replace("null /*__API__*/",json.dumps(api),1)
target=sys.argv[3] if len(sys.argv)>3 else 'dist/index.html'
pathlib.Path(target).parent.mkdir(parents=True,exist_ok=True)
pathlib.Path(target).write_text(out)
print('ok')
