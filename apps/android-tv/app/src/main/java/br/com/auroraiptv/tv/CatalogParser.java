package br.com.auroraiptv.tv;

import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.*;

/** Bounded streaming M3U parser used only by the Android catalog writer. */
final class CatalogParser {
    interface Sink { void accept(JSONObject item) throws Exception; }
    private static final Pattern ATTR=Pattern.compile("([\\w-]+)\\s*=\\s*\"([^\"]*)\"");
    private static final Pattern EPISODE=Pattern.compile("(?:^|\\s)[-.–]?\\s*(?:s(\\d{1,3})e(\\d{1,3})|(\\d{1,3})x(\\d{1,3}))(?:\\b|$)",Pattern.CASE_INSENSITIVE);
    private static final Pattern LOOSE_EPISODE=Pattern.compile("(?:s(\\d{1,3})e(\\d{1,3})|(\\d{1,3})x(\\d{1,3}))\\b",Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_EPISODE=Pattern.compile("\\s*[-–.]?\\s*(?:s\\d{1,3}e\\d{1,3}|\\d{1,3}x\\d{1,3})\\b.*$",Pattern.CASE_INSENSITIVE);
    private static final Pattern MARKS=Pattern.compile("\\p{M}+");
    private static final Pattern SERIES_GROUP=Pattern.compile("(?:^|[\\W\\s])(series?|seriados|tv\\s*shows)(?:[\\W\\s]|$)");
    private static final Pattern MOVIE_GROUP=Pattern.compile("(?:^|[\\W\\s])(filmes?|movies?|cinema|vod)(?:[\\W\\s]|$)");
    private static final Pattern LIVE_GROUP=Pattern.compile("(?:^|[\\W\\s])(ao\\s*vivo|canais?|live|esportes?|sports?|noticias?|news|tv)(?:[\\W\\s]|$)");
    private static final Pattern ADULT=Pattern.compile("(?:^|[\\s|/()\\[\\]_-])(?:\\+18|18\\+|adult[oa]?s?|xxx|porn[ôo]|er[oó]tic[oa]s?)(?=$|[\\s|/()\\[\\]_-])",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
    static String normalized(String text) {return MARKS.matcher(Normalizer.normalize(text,Normalizer.Form.NFD)).replaceAll("").toLowerCase(Locale.ROOT);}
    static boolean restricted(JSONObject row) {return row.optBoolean("restricted") || ADULT.matcher(row.optString("group")+" "+row.optString("title")).find();}
    static String seriesTitle(String title) {
        String base=TITLE_EPISODE.matcher(title).replaceFirst("").trim();
        return base.isEmpty()?title:base;
    }
    static String seriesKey(String title){return seriesTitle(title).toLowerCase(Locale.ROOT);}
    static int[] episode(String title) {
        Matcher m=LOOSE_EPISODE.matcher(title);
        if(!m.find())return new int[]{0,0};
        return new int[]{Integer.parseInt(m.group(1)!=null?m.group(1):m.group(3)),Integer.parseInt(m.group(2)!=null?m.group(2):m.group(4))};
    }
    static String classify(String group,String title) {
        String g=" "+normalized(group)+" ";
        if(SERIES_GROUP.matcher(g).find() || EPISODE.matcher(title).find())return "series";
        if(MOVIE_GROUP.matcher(g).find())return "movies";
        if(LIVE_GROUP.matcher(g).find())return "live";
        return "unknown";
    }
    static String resolve(String base,String raw) {
        if(raw==null || raw.isEmpty())return "";
        try {
            String value=raw.trim();URL url=base.isEmpty()?new URL(value):new URL(new URL(base),value);
            if(!"http".equalsIgnoreCase(url.getProtocol())&&!"https".equalsIgnoreCase(url.getProtocol()))return "";
            // Preserve absolute provider bytes/case like the old JS parser, including
            // spaces and pipe options it accepted. Playback still validates HTTP(S).
            return value.regionMatches(true,0,"http://",0,7)||value.regionMatches(true,0,"https://",0,8)?value:url.toExternalForm();
        }
        catch(Exception ignored){return "";}
    }
    private static final class Lines {
        final Reader input;final char[] buffer=new char[65536];int position,end;
        Lines(Reader input){this.input=input;}
        String next()throws IOException{
            StringBuilder out=new StringBuilder();
            while(true){
                if(position>=end){end=input.read(buffer);position=0;if(end<0)return out.length()==0?null:out.toString().replace("\r","").trim();if(end==0)continue;}
                int start=position;while(position<end && buffer[position]!='\n')position++;
                if(out.length()+position-start>1_048_576)throw new IOException("Uma linha da lista ultrapassa o limite de segurança.");
                out.append(buffer,start,position-start);
                if(position<end){position++;return out.toString().replace("\r","").trim();}
            }
        }
    }
    static final class Result {int entries;String guide="";}
    static Result scan(Reader raw,String base,Sink sink) throws Exception {
        Lines lines=new Lines(raw);
        Result result=new Result();String text=lines.next();
        if(text==null || !text.replace("\uFEFF","").startsWith("#EXTM3U"))throw new IOException("O arquivo precisa começar com #EXTM3U.");
        Matcher header=ATTR.matcher(text);while(header.find())if(header.group(1).equalsIgnoreCase("url-tvg")||header.group(1).equalsIgnoreCase("x-tvg-url"))result.guide=resolve(base,header.group(2).split(",")[0]);
        JSONObject pending=null;
        while((text=lines.next())!=null) {
            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
            if(text.regionMatches(true,0,"#EXTINF:",0,8)) {
                // Commas inside quoted attributes are not title separators.
                boolean quote=false;int comma=-1;
                for(int i=0;i<text.length();i++){char c=text.charAt(i);if(c=='"')quote=!quote;else if(c==','&&!quote){comma=i;break;}}
                Map<String,String> attrs=new HashMap<>();Matcher m=ATTR.matcher(comma<0?text:text.substring(0,comma));
                while(m.find())attrs.put(m.group(1).toLowerCase(Locale.ROOT),m.group(2));
                String title=comma<0?"":text.substring(comma+1).trim();
                pending=new JSONObject().put("title",title.isEmpty()?attrs.getOrDefault("tvg-name","Sem título"):title)
                    .put("group",attrs.getOrDefault("group-title","")).put("logo",resolve(base,attrs.getOrDefault("tvg-logo","")))
                    .put("tvgId",attrs.getOrDefault("tvg-id",""));
            }else if(pending!=null && text.startsWith("#EXTGRP:"))pending.put("group",text.substring(8).trim());
            else if(pending!=null && !text.isEmpty() && !text.startsWith("#")) {
                String url=resolve(base,text);
                if(!url.isEmpty()) {
                    pending.put("url",url).put("type",classify(pending.optString("group"),pending.optString("title")));
                    sink.accept(pending);result.entries++;
                }
                pending=null;
            }
        }
        if(result.entries==0)throw new IOException("Nenhuma entrada de vídeo válida foi encontrada.");
        return result;
    }
}
