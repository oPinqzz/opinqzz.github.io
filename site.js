(function(){
  /* ---- content: data.json, rendered safely ---- */
  var DATA={books:[],posts:[]},$=function(id){return document.getElementById(id)};
  function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n}
  function render(){
    var sh=$('shelf')||el('ul'),ps=$('posts')||el('div');sh.textContent='';ps.textContent='';
    if(!DATA.books.length){var li=el('li','empty','Nothing on the shelf yet. Books will show up here.');sh.appendChild(li)}
    DATA.books.slice().reverse().forEach(function(b){
      var li=el('li');li.appendChild(el('b','',b.title));
      var m=[];if(b.author)m.push('by '+b.author);if(b.date)m.push(b.date);
      if(m.length)li.appendChild(el('span','small',m.join(', ')));
      if(b.note)li.appendChild(el('p','',b.note));
      sh.appendChild(li);
    });
    if(!DATA.posts.length)ps.appendChild(el('p','empty post','Nothing written down yet.'));
    DATA.posts.slice().reverse().forEach(function(p){
      var a=el('article','post');a.appendChild(el('h3','',p.title));a.appendChild(el('p','small',p.date||''));
      String(p.body||'').split(/\n\s*\n/).forEach(function(t){if(t.trim())a.appendChild(el('p','',t.trim()))});
      ps.appendChild(a);
    });
  }
  fetch('data.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(d&&Array.isArray(d.books)&&Array.isArray(d.posts))DATA=d;render();
  }).catch(render);

  /* ---- admin panel markup (same on every page) ---- */
  var box=document.createElement('div');
  box.innerHTML="<section id=\"admin\" hidden aria-label=\"Admin panel\"><div class=\"pnl\">\n  <div class=\"ph\"><b>the back room</b><button class=\"ghost\" id=\"pclose\" type=\"button\" style=\"margin:0\">close</button></div>\n  <form id=\"login\">\n    <p class=\"small\">No password lives in this site. Log in with a GitHub token that can write to this repo; it stays in your browser only.</p>\n    <label for=\"lo\">Repo owner</label><input id=\"lo\" required autocomplete=\"off\">\n    <label for=\"lr\">Repo name</label><input id=\"lr\" required autocomplete=\"off\">\n    <label for=\"lb\">Branch</label><input id=\"lb\" value=\"main\" required autocomplete=\"off\">\n    <label for=\"lt\">Token</label><input id=\"lt\" type=\"password\" required autocomplete=\"off\">\n    <label><input id=\"lk\" type=\"checkbox\" style=\"width:auto\"> remember on this device</label>\n    <button type=\"submit\">log in</button>\n  </form>\n  <div id=\"ed\" hidden>\n    <div data-for=\"books\"><h4>Add a book</h4>\n    <form id=\"fb\">\n      <label for=\"bt\">Title</label><input id=\"bt\" required>\n      <label for=\"ba\">Author</label><input id=\"ba\">\n      <label for=\"bn\">One line about it (optional)</label><input id=\"bn\">\n      <button type=\"submit\">add book</button>\n    </form></div>\n    <div data-for=\"posts\"><h4>Write a post</h4>\n    <form id=\"fp\">\n      <label for=\"pt\">Title</label><input id=\"pt\" required>\n      <label for=\"pb\">Text (blank line = new paragraph)</label><textarea id=\"pb\" required></textarea>\n      <button type=\"submit\">add post</button>\n    </form></div>\n    <h4>Already there</h4><ul id=\"lst\"></ul>\n    <div class=\"row\"><button type=\"button\" class=\"ghost\" id=\"lout\">log out</button></div>\n  </div>\n  <p id=\"pmsg\" role=\"status\"></p>\n</div></section>";
  document.body.appendChild(box.firstElementChild);
  var pg=document.body.dataset.page||'home';
  if(pg!=='home')document.querySelectorAll('#admin [data-for]').forEach(function(x){x.hidden=x.dataset.for!==(pg==='books'?'books':'posts')});

  /* ---- admin: GitHub API, no server, no database ---- */
  var adm=$('admin'),msg=$('pmsg'),cfg=null,sha=null;
  function say(t){msg.textContent=t||''}
  function open(){
    adm.hidden=false;
    var h=location.hostname,o='',r='',seg=location.pathname.split('/')[1];
    if(/\.github\.io$/.test(h)){o=h.split('.')[0];r=(seg&&seg!=='index.html')?seg:h}
    var saved=JSON.parse(localStorage.getItem('opq_cfg')||'null');
    if(saved){o=saved.o;r=saved.r;$('lb').value=saved.b}
    $('lo').value=o;$('lr').value=r;
    var tk=sessionStorage.getItem('opq_tk')||localStorage.getItem('opq_tk');
    if(tk){$('lt').value=tk;}
    $('lo').focus();
  }
  function close(){adm.hidden=true;if(location.hash==='#admin')history.replaceState(null,'',location.pathname)}
  function gh(path,opts){
    opts=opts||{};opts.headers={Authorization:'Bearer '+cfg.t,Accept:'application/vnd.github+json'};
    return fetch('https://api.github.com/repos/'+cfg.o+'/'+cfg.r+path,opts);
  }
  function b64(s){var by=new TextEncoder().encode(s),o='';by.forEach(function(x){o+=String.fromCharCode(x)});return btoa(o)}
  function unb64(s){var bin=atob(s.replace(/\s/g,'')),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new TextDecoder().decode(a)}
  function pageKeys(){var p=document.body.dataset.page;return p==='books'?[['books']]:p==='writing'?[['posts']]:[['books'],['posts']]}
  function listing(){
    var ul=$('lst');ul.textContent='';
    pageKeys().forEach(function(k){
      DATA[k[0]].forEach(function(it){
        var li=el('li');li.appendChild(el('span','',k[0]==='books'?'book: '+it.title:'post: '+it.title));
        var d=el('button','','remove');d.type='button';
        d.addEventListener('click',function(){
          if(!confirm('Remove "'+it.title+'"?'))return;
          DATA[k[0]]=DATA[k[0]].filter(function(x){return x.id!==it.id});save('Removed.');
        });
        li.appendChild(d);ul.appendChild(li);
      });
    });
  }
  function save(ok){
    say('saving to GitHub…');
    var body={message:'update data.json from the back room',content:b64(JSON.stringify(DATA,null,2)+'\n'),branch:cfg.b};
    if(sha)body.sha=sha;
    return gh('/contents/data.json',{method:'PUT',body:JSON.stringify(body)}).then(function(r){
      if(!r.ok)throw new Error(r.status===409||r.status===422?'out of sync, log in again to reload':'GitHub said '+r.status);
      return r.json();
    }).then(function(j){sha=j.content.sha;render();listing();say((ok||'Saved.')+' The live site updates in about a minute.')})
    .catch(function(e){say('Could not save: '+e.message)});
  }
  $('login').addEventListener('submit',function(e){
    e.preventDefault();
    cfg={o:$('lo').value.trim(),r:$('lr').value.trim(),b:$('lb').value.trim(),t:$('lt').value.trim()};
    say('checking…');
    gh('').then(function(r){
      if(r.status===401)throw new Error('token rejected');
      if(r.status===404)throw new Error('repo not found (or the token cannot see it)');
      return r.json();
    }).then(function(j){
      if(!j.permissions||!j.permissions.push)throw new Error('this token cannot write to the repo');
      localStorage.setItem('opq_cfg',JSON.stringify({o:cfg.o,r:cfg.r,b:cfg.b}));
      (($('lk').checked)?localStorage:sessionStorage).setItem('opq_tk',cfg.t);
      return gh('/contents/data.json?ref='+encodeURIComponent(cfg.b));
    }).then(function(r){
      if(r.status===404){sha=null;return null}
      if(!r.ok)throw new Error('GitHub said '+r.status);
      return r.json();
    }).then(function(j){
      if(j){sha=j.sha;var d=JSON.parse(unb64(j.content));if(Array.isArray(d.books)&&Array.isArray(d.posts))DATA=d}
      $('login').hidden=true;$('ed').hidden=false;render();listing();say('In. Add something.');
    }).catch(function(err){say('Login failed: '+err.message)});
  });
  function today(){return new Date().toISOString().slice(0,10)}
  function uid(){return Date.now().toString(36)}
  $('fb').addEventListener('submit',function(e){
    e.preventDefault();
    DATA.books.push({id:uid(),title:$('bt').value.trim(),author:$('ba').value.trim(),note:$('bn').value.trim(),date:today()});
    save('Book added.').then(function(){e.target.reset()});
  });
  $('fp').addEventListener('submit',function(e){
    e.preventDefault();
    DATA.posts.push({id:uid(),title:$('pt').value.trim(),body:$('pb').value.trim(),date:today()});
    save('Post added.').then(function(){e.target.reset()});
  });
  $('lout').addEventListener('click',function(){
    sessionStorage.removeItem('opq_tk');localStorage.removeItem('opq_tk');cfg=null;
    $('lt').value='';$('ed').hidden=true;$('login').hidden=false;say('Logged out.');
  });
  $('door').addEventListener('click',open);
  $('pclose').addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!adm.hidden)close()});
  if(location.hash==='#admin')open();
  window.addEventListener('hashchange',function(){if(location.hash==='#admin')open()});
})();
